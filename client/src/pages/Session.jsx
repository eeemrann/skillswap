import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-react';
import api from '../api/axios';
import { connectSocket } from '../api/socket';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import { CallController, listDevices } from '../lib/call';
import { creditsLabel, errorMessage, formatClock, formatDateTime, formatDuration, formatTime, idOf } from '../lib/format';
import { useDocumentTitle, useNow, useQuery } from '../lib/hooks';
import { useToast } from '../lib/toast';

function VideoTile({ stream, muted = false, mirrored = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (element && element.srcObject !== stream) element.srcObject = stream;
  }, [stream]);
  return <video ref={ref} className={mirrored ? 'mirror' : ''} autoPlay playsInline muted={muted} />;
}

function Ctrl({ icon, label, onClick, off = false, danger = false, badge = false, disabled = false, active = false }) {
  return (
    <button type="button" className={`ctrl ${off ? 'off' : ''} ${danger ? 'end' : ''} ${active ? 'active' : ''}`} onClick={onClick} aria-label={label} title={label} aria-pressed={off || active ? true : undefined} disabled={disabled}>
      <Icon name={icon} size={22} />
      {badge && <i className="ctrl-dot" />}
    </button>
  );
}

function DeviceSelects({ controller, devices, state }) {
  const toast = useToast();
  const change = async (kind, deviceId) => {
    try {
      if (state.joined) await controller.switchDevice(kind, deviceId);
      else await controller.startPreview({ [kind === 'audio' ? 'audioId' : 'videoId']: deviceId });
    } catch { toast.error('Could not switch to that device.'); }
  };
  return (
    <div className="grid cols-2" style={{ '--gap': '12px' }}>
      <div className="field"><label htmlFor="dev-mic">Microphone</label>
        <select id="dev-mic" className="select" onChange={(event) => change('audio', event.target.value)} disabled={!devices.microphones.length}>
          {devices.microphones.length ? devices.microphones.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>) : <option>None found</option>}
        </select></div>
      <div className="field"><label htmlFor="dev-cam">Camera</label>
        <select id="dev-cam" className="select" onChange={(event) => change('video', event.target.value)} disabled={!devices.cameras.length}>
          {devices.cameras.length ? devices.cameras.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>) : <option>None found</option>}
        </select></div>
    </div>
  );
}

function Lobby({ controller, state, info, devices }) {
  const start = new Date(info.window.startsAt);
  const peerFirst = info.peer.name.split(' ')[0];
  return (
    <div className="lobby page-enter">
      <div className="lobby-preview card">
        <div className="preview-frame">
          {state.preview === 'ready' && state.hasVideo && state.cam ? <VideoTile stream={state.localStream} muted mirrored />
            : <div className="preview-off"><Avatar name="You" size="xl" /><p className="muted small">{state.preview === 'requesting' ? 'Starting your camera…' : state.hasVideo ? 'Camera is off' : 'No camera'}</p></div>}
          <div className="preview-controls">
            <Ctrl icon={state.mic && state.hasAudio ? 'mic' : 'micOff'} label={state.mic ? 'Mute microphone' : 'Unmute microphone'} off={!state.mic || !state.hasAudio} disabled={!state.hasAudio} onClick={() => controller.toggleMic()} />
            <Ctrl icon={state.cam && state.hasVideo ? 'video' : 'videoOff'} label={state.cam ? 'Turn camera off' : 'Turn camera on'} off={!state.cam || !state.hasVideo} disabled={!state.hasVideo} onClick={() => controller.toggleCam()} />
          </div>
        </div>
        {(state.preview === 'denied' || state.preview === 'unavailable') && (
          <div className="alert warning" role="alert"><Icon name="alert" /><div className="stack" style={{ '--gap': '8px' }}><span>{state.previewError}</span><button type="button" className="btn btn-secondary btn-sm" onClick={() => controller.startPreview()}>Try again</button><span className="tiny">You can still join and watch or listen without a camera.</span></div></div>
        )}
        <DeviceSelects controller={controller} devices={devices} state={state} />
      </div>

      <aside className="lobby-side card card-pad stack" style={{ '--gap': '18px' }}>
        <div className="stack" style={{ '--gap': '6px' }}>
          <span className="eyebrow">{info.booking.role === 'learner' ? 'Learning' : 'Teaching'}</span>
          <h1 style={{ fontSize: 26 }}>{info.booking.skill}</h1>
        </div>
        <div className="row nowrap"><Avatar name={info.peer.name} src={info.peer.profilePicture} size="lg" /><div className="stack" style={{ '--gap': '1px' }}><strong>{info.peer.name}</strong><span className="small muted">{info.booking.role === 'learner' ? 'Your teacher' : 'Your learner'}</span></div></div>
        <ul className="facts">
          <li><Icon name="calendar" size={16} /> {formatDateTime(start)}</li>
          <li><Icon name="clock" size={16} /> {formatDuration(info.booking.durationMinutes)} · {formatTime(start)} your time</li>
          <li><Icon name="wallet" size={16} /> {creditsLabel(info.booking.credits)} · held until the session is confirmed</li>
        </ul>
        {info.booking.note && <p className="note small muted">“{info.booking.note}”</p>}
        {state.joinError && <p className="alert error" role="alert">{state.joinError}</p>}
        <button type="button" className="btn btn-primary btn-lg" onClick={() => controller.join()} disabled={state.joining || state.preview === 'requesting'}>
          {state.joining ? <span className="spinner" /> : <><Icon name="video" size={18} /> Join session</>}
        </button>
        <p className="tiny faint center">Video is peer-to-peer, encrypted and never recorded. {peerFirst} will see you when you join.</p>
        <Link className="btn btn-ghost btn-sm" to="/bookings"><Icon name="arrowLeft" size={14} /> Back to sessions</Link>
      </aside>
    </div>
  );
}

function ChatPanel({ messages, onSend, onClose }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);
  const submit = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    const answer = await onSend(body);
    if (!answer.ok) { setError(answer.message || 'Message not sent.'); setDraft(body); } else setError('');
  };
  return (
    <aside className="call-panel" aria-label="Session chat">
      <header><strong>Chat</strong><button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close chat"><Icon name="close" size={16} /></button></header>
      <div className="call-chat" aria-live="polite">
        {messages.length === 0 && <p className="small faint center" style={{ marginTop: 24 }}>Share links and notes here. Messages are saved to your conversation.</p>}
        {messages.map((message) => (
          <div key={message._id} className={`bubble ${message.mine ? 'mine' : ''}`}><p>{message.body}</p><time>{formatTime(message.createdAt)}</time></div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="call-compose">
        {error && <span className="tiny negative-text">{error}</span>}
        <input className="input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type a message…" maxLength={1000} aria-label="Message" />
        <button type="submit" className="btn btn-primary btn-icon" disabled={!draft.trim()} aria-label="Send"><Icon name="send" size={16} /></button>
      </form>
    </aside>
  );
}

function InCall({ controller, state, info, myId, devices, remaining, overBy }) {
  const toast = useToast();
  const stageRef = useRef(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const [settings, setSettings] = useState(false);
  const peerFirst = info.peer.name.split(' ')[0];

  const history = useQuery(() => api.get(`/messages/${info.peer._id}`).then((r) => r.data), [info.peer._id]);
  const messages = useMemo(() => {
    const stored = (history.data || []).filter((m) => m.booking === info.booking._id).map((m) => ({ _id: m._id, body: m.body, createdAt: m.createdAt, mine: m.sender === myId }));
    const live = state.messages.map((m) => ({ _id: m._id, body: m.body, createdAt: m.createdAt, mine: m.from === myId }));
    const merged = new Map([...stored, ...live].map((m) => [m._id, m]));
    return [...merged.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [history.data, state.messages, info.booking._id, myId]);
  const unread = !chatOpen && messages.length > seen && messages.at(-1)?.mine === false;

  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.('input, textarea, select') || event.metaKey || event.ctrlKey) return;
      if (event.key === 'm') controller.toggleMic();
      if (event.key === 'v') controller.toggleCam();
    };
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', warn); };
  }, [controller]);

  const minutesLeft = Math.ceil(remaining / 60000);
  useEffect(() => {
    if (minutesLeft === 5) toast.info('5 minutes left in this session.');
    if (minutesLeft === 1) toast.info('1 minute left. The room stays open a little longer if you need to wrap up.');
  }, [minutesLeft, toast]);

  const toggleChat = () => { setChatOpen((open) => !open); setSeen(messages.length); };
  const fullscreen = () => { if (document.fullscreenElement) document.exitFullscreen(); else stageRef.current?.requestFullscreen?.(); };
  const share = () => (state.sharing ? controller.stopSharing() : controller.shareScreen());
  const peerShowsVideo = state.peerMedia.video || state.peerMedia.screen;
  const localStream = state.sharing ? state.screenStream : state.localStream;
  const showLocalVideo = state.sharing || (state.hasVideo && state.cam);

  return (
    <div className="call" ref={stageRef}>
      <header className="call-top">
        <div className="stack" style={{ '--gap': '0px', minWidth: 0 }}><strong className="truncate">{info.booking.skill}</strong><span className="tiny call-muted truncate">with {info.peer.name}</span></div>
        <div className={`call-timer ${remaining <= 0 ? 'over' : remaining < 300000 ? 'warn' : ''}`} role="timer" aria-label="Time remaining">
          <Icon name="clock" size={15} />{remaining > 0 ? `${formatClock(remaining / 1000)} left` : `+${formatClock(overBy / 1000)} over time`}
        </div>
        <div className="row nowrap call-top-right">
          {state.quality && <span className={`quality ${state.quality}`} title={`Connection: ${state.quality}`}><Icon name="signal" size={15} /><span className="hide-mobile">{state.quality}</span></span>}
          <button type="button" className="btn btn-ghost btn-icon btn-sm call-btn" onClick={fullscreen} aria-label="Toggle full screen"><Icon name="maximize" size={16} /></button>
        </div>
      </header>

      <div className="call-body">
        <div className="stage">
          {state.remoteStream && peerShowsVideo ? <VideoTile stream={state.remoteStream} /> : (
            <div className="stage-empty"><Avatar name={info.peer.name} src={info.peer.profilePicture} size="xl" />
              <p>{!state.peerPresent ? `Waiting for ${peerFirst} to join…` : state.connection === 'connected' ? `${peerFirst}’s camera is off` : 'Connecting…'}</p>
              {!state.peerPresent && <p className="tiny call-muted">They will see you as soon as they enter the room.</p>}
            </div>
          )}
          {/* Audio keeps playing when the remote camera is off or hidden behind the avatar. */}
          {state.remoteStream && !peerShowsVideo && <div className="sr-only"><VideoTile stream={state.remoteStream} /></div>}

          <div className="stage-badges">
            {state.peerPresent && !state.peerMedia.audio && <span className="pill"><Icon name="micOff" size={13} /> {peerFirst} is muted</span>}
            {state.peerMedia.screen && <span className="pill brand"><Icon name="screen" size={13} /> {peerFirst} is sharing their screen</span>}
            {state.connection === 'reconnecting' && <span className="pill warn"><span className="spinner" /> Reconnecting…</span>}
          </div>

          <div className="pip">
            {showLocalVideo && localStream ? <VideoTile stream={localStream} muted mirrored={!state.sharing} /> : <Avatar name="You" size="lg" />}
            <span className="pip-label">You{!state.mic ? ' · muted' : ''}{state.sharing ? ' · sharing' : ''}</span>
          </div>
        </div>
        {chatOpen && <ChatPanel messages={messages} onSend={(body) => controller.sendChat(body)} onClose={toggleChat} />}
      </div>

      <footer className="controls">
        <Ctrl icon={state.mic && state.hasAudio ? 'mic' : 'micOff'} label={state.mic ? 'Mute (M)' : 'Unmute (M)'} off={!state.mic || !state.hasAudio} disabled={!state.hasAudio} onClick={() => controller.toggleMic()} />
        <Ctrl icon={state.cam && state.hasVideo ? 'video' : 'videoOff'} label={state.cam ? 'Camera off (V)' : 'Camera on (V)'} off={!state.cam || !state.hasVideo} disabled={!state.hasVideo} onClick={() => controller.toggleCam()} />
        <Ctrl icon="screen" label={state.sharing ? 'Stop sharing' : 'Share screen'} active={state.sharing} onClick={share} disabled={!navigator.mediaDevices?.getDisplayMedia} />
        <Ctrl icon="message" label="Chat" active={chatOpen} badge={unread} onClick={toggleChat} />
        <Ctrl icon="settings" label="Devices" onClick={() => setSettings(true)} />
        <Ctrl icon="phoneOff" label="Leave session" danger onClick={() => controller.leave()} />
      </footer>

      <Modal open={settings} onClose={() => setSettings(false)} title="Devices" description="Switch microphone or camera without leaving the session.">
        <DeviceSelects controller={controller} devices={devices} state={state} />
      </Modal>
    </div>
  );
}

function Ended({ controller, state, info, now, onConfirmed }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const learner = info.booking.role === 'learner';
  const started = new Date(info.window.startsAt).getTime() <= now;
  const canRejoin = state.ended === 'left' && now < new Date(info.window.closesAt).getTime();

  const confirm = async () => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/bookings/${info.booking._id}/complete`);
      toast.success(data.message);
      setConfirmed(true);
      onConfirmed();
    } catch (error) {
      if (error.response?.status !== 402) toast.error(errorMessage(error, 'Could not confirm the session.'));
    } finally { setBusy(false); }
  };

  const headline = { time: 'The session time is up', replaced: 'You joined from another tab', left: 'You left the session' }[state.ended] || 'Session ended';
  return (
    <div className="ended page-enter">
      <div className="card card-pad stack ended-card" style={{ '--gap': '16px' }}>
        <span className="empty-icon"><Icon name={confirmed ? 'checkCircle' : 'video'} size={26} /></span>
        <h1 style={{ fontSize: 26 }}>{confirmed ? 'All done. Thank you!' : headline}</h1>
        {state.ended === 'replaced' ? <p className="muted">This session is now open in another window. Close this one.</p> : learner ? (
          confirmed ? <p className="muted">{creditsLabel(info.booking.credits)} went to {info.peer.name}. Leave a review from your sessions page.</p>
            : started ? <p className="muted">If the session went well, confirm it to release {creditsLabel(info.booking.credits)} to {info.peer.name}. If something went wrong, cancel it from your sessions page instead.</p>
              : <p className="muted">The session has not started yet.</p>
        ) : <p className="muted">Thanks for teaching! {creditsLabel(info.booking.credits)} are released when {info.peer.name} confirms the session, or automatically 24 hours later.</p>}
        <div className="row">
          {learner && started && !confirmed && state.ended !== 'replaced' && <button type="button" className="btn btn-success" onClick={confirm} disabled={busy}>{busy ? <span className="spinner" /> : <><Icon name="check" size={16} /> Confirm & release credits</>}</button>}
          {canRejoin && <button type="button" className="btn btn-secondary" onClick={() => controller.returnToLobby()}>Rejoin session</button>}
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/bookings')}>Back to sessions</button>
        </div>
      </div>
    </div>
  );
}

function Room({ info }) {
  const { getToken } = useAuth();
  const user = useSelector((state) => state.auth.user);
  const myId = idOf(user);
  const now = useNow(1000);
  const [offset] = useState(() => Date.parse(info.serverTime) - Date.now());
  const [controller] = useState(() => new CallController({ socket: connectSocket(getToken), bookingId: info.booking._id, myId, peerId: info.peer._id, iceServers: info.iceServers }));
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const devices = useQuery(listDevices, [state.preview === 'ready']);
  useDocumentTitle(`${info.booking.skill} session`);

  useEffect(() => {
    controller.init();
    controller.startPreview();
    return () => controller.destroy();
  }, [controller]);

  const serverNow = now + offset;
  const remaining = Date.parse(info.window.endsAt) - serverNow;
  const overBy = -remaining;
  const noDevices = { microphones: [], cameras: [] };

  return (
    <div className={`call-page ${state.joined ? 'in-call' : ''}`}>
      {!state.joined && !state.ended && <header className="call-page-head"><Link to="/bookings" className="btn btn-ghost btn-sm"><Icon name="arrowLeft" size={15} /> Sessions</Link></header>}
      {state.ended ? <Ended controller={controller} state={state} info={info} now={serverNow} onConfirmed={() => {}} />
        : state.joined ? <InCall controller={controller} state={state} info={info} myId={myId} devices={devices.data || noDevices} remaining={remaining} overBy={overBy} />
          : <Lobby controller={controller} state={state} info={info} devices={devices.data || noDevices} />}
    </div>
  );
}

function Unavailable({ info, reload }) {
  const now = useNow(1000);
  const [offset] = useState(() => Date.parse(info.serverTime) - Date.now());
  const opensAt = Date.parse(info.window.opensAt);
  const tooEarly = info.access.code === 'TOO_EARLY';
  const msLeft = opensAt - (now + offset);

  useEffect(() => {
    if (!tooEarly) return undefined;
    const timer = setTimeout(reload, Math.min(Math.max(msLeft, 500), 2147483647));
    return () => clearTimeout(timer);
  }, [tooEarly, msLeft, reload]);

  const wait = msLeft > 0 ? formatClock(msLeft / 1000) : '';
  const copy = {
    TOO_EARLY: ['The room is not open yet', `It opens 10 minutes before the start.${wait ? ` Opens in ${wait}.` : ''}`],
    NOT_CONFIRMED: ['Waiting for confirmation', `${info.peer.name} has not confirmed this session yet.`],
    CLOSED: ['This session has ended', 'The room closed 15 minutes after the scheduled end.'],
    COMPLETED: ['This session is complete', 'It has been confirmed and credits were transferred.'],
    UNAVAILABLE: ['This session is unavailable', info.access.message]
  }[info.access.code] || ['Unavailable', info.access.message];
  return (
    <div className="ended page-enter">
      <div className="card card-pad stack ended-card" style={{ '--gap': '16px' }}>
        <span className="empty-icon"><Icon name="clock" size={26} /></span>
        <h1 style={{ fontSize: 26 }}>{copy[0]}</h1>
        <p className="muted">{copy[1]}</p>
        <div className="row"><Link className="btn btn-primary" to="/bookings">Back to sessions</Link>{info.access.code === 'COMPLETED' && <Link className="btn btn-secondary" to="/bookings">Leave a review</Link>}</div>
      </div>
    </div>
  );
}

export default function Session() {
  const { bookingId } = useParams();
  const info = useQuery(() => api.get(`/sessions/${bookingId}`).then((r) => r.data), [bookingId], { focus: false });
  useDocumentTitle('Session');

  if (info.loading) return <div className="loading-screen" role="status"><span className="spinner" /><span>Preparing your session…</span></div>;
  if (!info.data) {
    return (
      <div className="loading-screen" role="alert">
        <h1 style={{ fontSize: 24 }}>Session not found</h1>
        <p className="muted">{errorMessage(info.error, 'It may have been removed, or you are not part of it.')}</p>
        <Link className="btn btn-primary" to="/bookings">Back to sessions</Link>
      </div>
    );
  }
  return info.data.access.ok ? <Room key={bookingId} info={info.data} /> : <Unavailable info={info.data} reload={info.reload} />;
}
