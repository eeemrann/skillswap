/**
 * Browser side of a SkillSwap video session.
 *
 * One CallController owns the camera/microphone, the RTCPeerConnection and the
 * socket events of a single room. It follows the WebRTC "perfect negotiation"
 * pattern so simultaneous offers, reconnects, ICE restarts and screen-share track
 * swaps all resolve without deadlocks. React reads it through useSyncExternalStore.
 */

const INITIAL_STATE = {
  preview: 'idle',            // idle | requesting | ready | denied | unavailable
  previewError: '',
  mic: true,
  cam: true,
  hasAudio: false,
  hasVideo: false,
  sharing: false,
  joined: false,
  joining: false,
  joinError: '',
  peerPresent: false,
  peerName: '',
  peerMedia: { audio: true, video: true, screen: false },
  connection: 'idle',         // idle | connecting | connected | reconnecting
  quality: null,              // good | fair | poor
  ended: null,                // null | time | replaced | left
  mediaVersion: 0,            // bumped when tracks change inside the same MediaStream object
  localStream: null,
  remoteStream: null,
  screenStream: null,
  messages: []
};

const describeMediaError = (error) => {
  switch (error?.name) {
    case 'NotAllowedError': case 'SecurityError': return ['denied', 'Camera and microphone access is blocked. Allow it in your browser’s address bar, then try again.'];
    case 'NotFoundError': case 'OverconstrainedError': return ['unavailable', 'No camera or microphone was found on this device.'];
    case 'NotReadableError': return ['unavailable', 'Your camera or microphone is being used by another app.'];
    default: return ['unavailable', 'Could not start your camera or microphone.'];
  }
};

export class CallController {
  constructor({ socket, bookingId, myId, peerId, iceServers }) {
    this.socket = socket;
    this.bookingId = bookingId;
    this.myId = myId;
    this.peerId = peerId;
    this.iceServers = iceServers;
    this.polite = String(myId) > String(peerId);
    this.state = { ...INITIAL_STATE };
    this.listeners = new Set();
    this.local = null;
    this.pc = null;
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.pendingCandidates = [];
    this.statsTimer = null;
    this.restartTimer = null;
    this.lastStats = null;
    this.destroyed = false;
    this.handlers = {};
  }

  subscribe = (listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getState = () => this.state;
  set(patch) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  /** (Re)starts after construction; safe to call again after destroy() (React StrictMode). */
  init() {
    this.destroyed = false;
  }

  // ───────── local media ─────────

  /** Opens camera + microphone, degrading to audio-only, then to nothing. */
  async startPreview(devices = {}) {
    this.set({ preview: 'requesting', previewError: '' });
    const audio = devices.audioId ? { deviceId: { exact: devices.audioId }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true };
    const video = devices.videoId ? { deviceId: { exact: devices.videoId }, width: { ideal: 1280 }, height: { ideal: 720 } } : { width: { ideal: 1280 }, height: { ideal: 720 } };
    let stream = null;
    let failure = null;
    for (const constraints of [{ audio, video }, { audio }, { video }]) {
      try { stream = await navigator.mediaDevices.getUserMedia(constraints); break; } catch (error) { failure = failure || error; }
    }
    if (this.destroyed) { stream?.getTracks().forEach((track) => track.stop()); return; }
    this.stopLocal();
    if (!stream) {
      const [preview, message] = describeMediaError(failure);
      this.set({ preview, previewError: message, localStream: null, hasAudio: false, hasVideo: false });
      return;
    }
    this.local = stream;
    this.set({
      preview: 'ready', previewError: '', localStream: stream,
      hasAudio: stream.getAudioTracks().length > 0, hasVideo: stream.getVideoTracks().length > 0,
      mic: this.state.mic, cam: this.state.cam
    });
    this.applyEnabled();
    if (this.pc) this.attachLocalTracks();
  }

  stopLocal() {
    this.local?.getTracks().forEach((track) => track.stop());
    this.local = null;
  }

  applyEnabled() {
    this.local?.getAudioTracks().forEach((track) => { track.enabled = this.state.mic; });
    this.local?.getVideoTracks().forEach((track) => { track.enabled = this.state.cam; });
  }

  broadcastMedia() {
    this.socket.emit('session:media', { audio: this.state.hasAudio && this.state.mic, video: (this.state.hasVideo && this.state.cam) || this.state.sharing, screen: this.state.sharing });
  }

  toggleMic() {
    if (!this.state.hasAudio) return;
    this.set({ mic: !this.state.mic });
    this.applyEnabled();
    if (this.state.joined) this.broadcastMedia();
  }

  toggleCam() {
    if (!this.state.hasVideo) return;
    this.set({ cam: !this.state.cam });
    this.applyEnabled();
    if (this.state.joined) this.broadcastMedia();
  }

  /** Swaps one device (e.g. a different microphone) without leaving the room. */
  async switchDevice(kind, deviceId) {
    const stream = await navigator.mediaDevices.getUserMedia({ [kind]: { deviceId: { exact: deviceId } } });
    const track = stream.getTracks()[0];
    if (!this.local) this.local = new MediaStream();
    this.local.getTracks().filter((old) => old.kind === kind).forEach((old) => { this.local.removeTrack(old); old.stop(); });
    this.local.addTrack(track);
    track.enabled = kind === 'audio' ? this.state.mic : this.state.cam;
    const sender = this.pc?.getSenders().find((item) => item.track?.kind === kind);
    if (sender && !this.state.sharing) await sender.replaceTrack(track);
    else if (this.pc && !sender) this.pc.addTrack(track, this.local);
    this.set({ localStream: this.local, hasAudio: this.local.getAudioTracks().length > 0, hasVideo: this.local.getVideoTracks().length > 0, mediaVersion: this.state.mediaVersion + 1 });
  }

  async shareScreen() {
    if (this.state.sharing || !navigator.mediaDevices?.getDisplayMedia) return;
    let display;
    try { display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false }); } catch { return; }
    const track = display.getVideoTracks()[0];
    track.onended = () => this.stopSharing();
    this.screenTrack = track;
    const sender = this.pc?.getSenders().find((item) => item.track?.kind === 'video');
    if (sender) await sender.replaceTrack(track);
    else if (this.pc) this.pc.addTrack(track, display);
    this.set({ sharing: true, screenStream: display });
    this.broadcastMedia();
  }

  async stopSharing() {
    if (!this.state.sharing) return;
    const camera = this.local?.getVideoTracks()[0] || null;
    const sender = this.pc?.getSenders().find((item) => item.track === this.screenTrack);
    this.screenTrack?.stop();
    if (sender) { if (camera) await sender.replaceTrack(camera); else this.pc.removeTrack(sender); }
    this.screenTrack = null;
    this.set({ sharing: false, screenStream: null });
    if (this.state.joined) this.broadcastMedia();
  }

  // ───────── room ─────────

  async join() {
    if (this.state.joined || this.state.joining) return;
    this.set({ joining: true, joinError: '' });
    this.bindSocket();
    try {
      if (!this.socket.connected) await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 10000);
        this.socket.once('connect', () => { clearTimeout(timer); resolve(); });
        this.socket.connect?.();
      });
      const answer = await this.emitJoin();
      if (!answer.ok) { this.set({ joining: false, joinError: answer.message || 'Could not join the session.' }); return; }
      this.set({ joining: false, joined: true, ended: null });
      this.broadcastMedia();
      const peer = answer.peers?.[0];
      if (peer) { this.set({ peerPresent: true, peerName: peer.name }); this.startPeer(); }
    } catch {
      this.set({ joining: false, joinError: 'Could not reach the session server. Check your connection and try again.' });
    }
  }

  emitJoin() {
    return new Promise((resolve) => this.socket.timeout(10000).emit('session:join', { bookingId: this.bookingId }, (error, answer) => resolve(error ? { ok: false, message: 'The server did not answer in time.' } : answer)));
  }

  bindSocket() {
    if (this.bound) return;
    this.bound = true;
    const on = (event, handler) => { this.handlers[event] = handler; this.socket.on(event, handler); };
    on('session:peer-joined', ({ name }) => { this.set({ peerPresent: true, peerName: name }); this.startPeer(true); });
    on('session:peer-left', () => { this.closePeer(); this.set({ peerPresent: false, peerMedia: { audio: true, video: true, screen: false } }); });
    on('session:signal', ({ data }) => this.handleSignal(data));
    on('session:media', ({ audio, video, screen }) => this.set({ peerMedia: { audio, video, screen } }));
    on('session:chat', (message) => this.set({ messages: [...this.state.messages.filter((item) => item._id !== message._id), message] }));
    on('session:ended', ({ reason }) => this.finish(reason || 'time'));
    on('session:replaced', () => this.finish('replaced'));
    on('disconnect', () => { if (this.state.joined) this.set({ connection: 'reconnecting' }); });
    // After a network drop the socket reconnects as a brand new connection and must re-enter the room.
    on('connect', async () => {
      if (!this.state.joined || this.destroyed) return;
      const answer = await this.emitJoin();
      if (!answer.ok) { this.finish(answer.code === 'CLOSED' ? 'time' : 'left'); return; }
      this.broadcastMedia();
      const peer = answer.peers?.[0];
      if (peer) { this.set({ peerPresent: true, peerName: peer.name }); this.startPeer(); } else { this.closePeer(); this.set({ peerPresent: false }); }
    });
  }

  unbindSocket() {
    Object.entries(this.handlers).forEach(([event, handler]) => this.socket.off(event, handler));
    this.handlers = {};
    this.bound = false;
  }

  sendChat(body) {
    return new Promise((resolve) => this.socket.emit('session:chat', { body }, (answer) => resolve(answer || { ok: false })));
  }

  leave() {
    if (this.state.joined) this.socket.emit('session:leave');
    this.finish('left');
  }

  finish(reason) {
    this.closePeer();
    this.stopSharingSilently();
    this.stopLocal();
    this.set({ joined: false, joining: false, ended: reason, localStream: null, peerPresent: false, connection: 'idle', quality: null, preview: 'idle' });
  }

  /** Back to the lobby after leaving, e.g. to rejoin while the room is still open. */
  returnToLobby() {
    this.set({ ended: null, joinError: '', messages: [] });
    return this.startPreview();
  }

  stopSharingSilently() {
    this.screenTrack?.stop();
    this.screenTrack = null;
    if (this.state.sharing) this.set({ sharing: false, screenStream: null });
  }

  // ───────── peer connection ─────────

  /** Sends our camera/microphone (or the screen, while sharing) over the current connection. */
  attachLocalTracks() {
    if (!this.pc) return;
    const have = new Set(this.pc.getSenders().map((sender) => sender.track).filter(Boolean));
    (this.local?.getTracks() || []).forEach((track) => {
      // While sharing, the screen replaces the camera on the wire.
      if (track.kind === 'video' && this.state.sharing) return;
      if (!have.has(track)) this.pc.addTrack(track, this.local);
    });
    if (this.state.sharing && this.screenTrack && !have.has(this.screenTrack)) this.pc.addTrack(this.screenTrack, this.state.screenStream);
  }

  /**
   * Opens a peer connection. The member who was already in the room (`initiator`) makes the offer;
   * the member who just joined waits for it and attaches their media after answering, so the two
   * never send offers at the same time. Perfect negotiation remains as a safety net.
   */
  startPeer(initiator = false) {
    this.closePeer();
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.pc = pc;
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.pendingCandidates = [];
    this.set({ connection: 'connecting' });

    pc.ontrack = ({ track, streams }) => {
      const stream = streams[0] || new MediaStream([track]);
      this.set({ remoteStream: stream, mediaVersion: this.state.mediaVersion + 1 });
      track.onunmute = () => this.set({ mediaVersion: this.state.mediaVersion + 1 });
    };
    pc.onicecandidate = ({ candidate }) => { if (candidate) this.socket.emit('session:signal', { candidate: candidate.toJSON() }); };
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
        this.socket.emit('session:signal', { description: pc.localDescription.toJSON() });
      } catch (error) {
        console.warn('Negotiation failed:', error.message);
      } finally {
        this.makingOffer = false;
      }
    };
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      clearTimeout(this.restartTimer);
      if (pc.connectionState === 'connected') this.set({ connection: 'connected' });
      else if (pc.connectionState === 'disconnected') {
        this.set({ connection: 'reconnecting' });
        this.restartTimer = setTimeout(() => { if (this.pc === pc && pc.connectionState !== 'connected') pc.restartIce(); }, 4000);
      } else if (pc.connectionState === 'failed') { this.set({ connection: 'reconnecting' }); pc.restartIce(); }
    };

    if (initiator) this.attachLocalTracks();
    // If the other side has nothing to offer (no camera), start sending our own media after a moment.
    else this.offerWait = setTimeout(() => { if (this.pc === pc) this.attachLocalTracks(); }, 1500);
    this.statsTimer = setInterval(() => this.sampleStats(), 4000);
    // If the link has not come up, nudge it with an ICE restart, then rebuild the connection from scratch.
    this.watchdog = setTimeout(() => { if (this.pc === pc && pc.connectionState !== 'connected') pc.restartIce(); }, 8000);
    this.watchdogRebuild = setTimeout(() => { if (this.pc === pc && pc.connectionState !== 'connected' && this.state.peerPresent) this.startPeer(!this.polite); }, 20000);
  }

  closePeer() {
    clearInterval(this.statsTimer);
    clearTimeout(this.restartTimer);
    clearTimeout(this.watchdog);
    clearTimeout(this.offerWait);
    clearTimeout(this.watchdogRebuild);
    this.statsTimer = null;
    this.lastStats = null;
    this.pendingCandidates = [];
    if (this.pc) {
      this.pc.ontrack = this.pc.onicecandidate = this.pc.onnegotiationneeded = this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.set({ remoteStream: null, connection: this.state.joined ? 'idle' : this.state.connection, quality: null });
  }

  /** Perfect negotiation: the polite peer yields on offer collisions, the impolite one ignores the incoming offer. */
  async handleSignal({ description, candidate }) {
    if (!this.pc) this.startPeer();
    const pc = this.pc;
    try {
      if (description) {
        const collision = description.type === 'offer' && (this.makingOffer || pc.signalingState !== 'stable');
        this.ignoreOffer = !this.polite && collision;
        if (this.ignoreOffer) return;
        await pc.setRemoteDescription(description);
        await this.flushCandidates(pc);
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          this.socket.emit('session:signal', { description: pc.localDescription.toJSON() });
          clearTimeout(this.offerWait);
          this.attachLocalTracks(); // joins the call with our media now that the negotiation is settled
        }
      } else if (candidate) {
        // A candidate can overtake the offer/answer it belongs to, so hold it until a remote description exists.
        if (!pc.remoteDescription) this.pendingCandidates.push(candidate);
        else await this.addCandidate(pc, candidate);
      }
    } catch (error) {
      console.warn('Signal handling failed:', error.message);
    }
  }

  /** A bad candidate (e.g. left over from an offer that was rolled back) must never abort the ones after it. */
  async addCandidate(pc, candidate) {
    try { await pc.addIceCandidate(candidate); } catch { /* stale or duplicate candidate: harmless */ }
  }

  async flushCandidates(pc) {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) await this.addCandidate(pc, candidate);
  }

  async sampleStats() {
    const pc = this.pc;
    if (!pc || pc.connectionState !== 'connected') return;
    try {
      const report = await pc.getStats();
      let rtt = null;
      let lost = 0;
      let received = 0;
      report.forEach((item) => {
        if (item.type === 'candidate-pair' && item.state === 'succeeded' && item.nominated && item.currentRoundTripTime != null) rtt = item.currentRoundTripTime;
        if (item.type === 'inbound-rtp' && !item.isRemote) { lost += item.packetsLost || 0; received += item.packetsReceived || 0; }
      });
      const previous = this.lastStats || { lost: 0, received: 0 };
      const deltaLost = Math.max(0, lost - previous.lost);
      const deltaReceived = Math.max(0, received - previous.received);
      this.lastStats = { lost, received };
      const loss = deltaLost + deltaReceived ? deltaLost / (deltaLost + deltaReceived) : 0;
      const quality = (rtt != null && rtt > 0.4) || loss > 0.1 ? 'poor' : (rtt != null && rtt > 0.15) || loss > 0.03 ? 'fair' : 'good';
      this.set({ quality });
    } catch { /* stats are best-effort */ }
  }

  /** Releases everything. Safe to call repeatedly. */
  destroy() {
    this.destroyed = true;
    if (this.state.joined) this.socket.emit('session:leave');
    this.unbindSocket();
    this.closePeer();
    this.stopSharingSilently();
    this.stopLocal();
    this.state = { ...INITIAL_STATE };
  }
}

export async function listDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      microphones: devices.filter((device) => device.kind === 'audioinput'),
      cameras: devices.filter((device) => device.kind === 'videoinput')
    };
  } catch {
    return { microphones: [], cameras: [] };
  }
}
