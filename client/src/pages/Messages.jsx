import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Icon from '../components/Icon';
import api from '../api/axios';
import { fetchUnreadCounts } from '../redux/notificationSlice';

const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const entityId = (entity) => typeof entity === 'string' ? entity : entity?._id;

function Messages() {
  const currentUser = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const [connections, setConnections] = useState([]);
  const [userId, setUserId] = useState(() => searchParams.get('with') || '');
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  const loadMessages = useCallback(async (targetId, silent = false, isActive = () => true) => {
    if (!targetId) return;
    try {
      if (!silent) setLoadingMessages(true);
      const { data } = await api.get(`/messages/${targetId}`);
      if (isActive()) {
        setMessages(data);
        setError('');
        dispatch(fetchUnreadCounts());
      }
    } catch (requestError) {
      if (isActive()) setError(requestError.response?.data?.message || 'Could not load this conversation.');
    } finally {
      if (!silent && isActive()) setLoadingMessages(false);
    }
  }, [dispatch]);

  useEffect(() => {
    let active = true;
    api.get('/bookings').then(({ data }) => {
      if (!active) return;
      const ownId = currentUser?._id || currentUser?.id;
      const connected = new Map();
      data.filter((booking) => ['accepted', 'completed'].includes(booking.status)).forEach((booking) => {
        const providerId = entityId(booking.provider);
        const requesterId = entityId(booking.requester);
        const other = providerId === ownId ? booking.requester : requesterId === ownId ? booking.provider : null;
        if (entityId(other)) connected.set(entityId(other), { id: entityId(other), name: other.name || 'Member' });
      });
      const list = [...connected.values()];
      setConnections(list);
      setUserId((current) => list.some((item) => item.id === current) ? current : list[0]?.id || '');
    }).catch((requestError) => active && setError(requestError.response?.data?.message || 'Could not load your exchange partners.'))
      .finally(() => active && setLoadingConnections(false));
    return () => { active = false; };
  }, [currentUser?._id, currentUser?.id]);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    queueMicrotask(() => active && loadMessages(userId, false, () => active));
    const refresh = () => { if (!document.hidden && active) loadMessages(userId, true, () => active); };
    const timer = window.setInterval(refresh, 4000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [loadMessages, userId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const onSend = async (event) => {
    event.preventDefault();
    const cleanBody = body.trim();
    if (!cleanBody || !userId || sending) return;
    setSending(true);
    try {
      await api.post(`/messages/${userId}`, { body: cleanBody });
      setBody('');
      setError('');
      await loadMessages(userId, true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Message could not be sent.');
    } finally { setSending(false); }
  };

  const activePartner = connections.find((connection) => connection.id === userId);
  const ownId = currentUser?._id || currentUser?.id;

  return (
    <AppShell eyebrow="TERMINAL_SESSION" title="Communication" description="A private high-signal channel for active exchange partners.">
      {error && <p className="status-message error" role="alert">{error}</p>}
      <div className="chat-hub-container foundry-terminal page-enter">
        <aside className="convo-rail">
          <header className="convo-rail-header"><span className="section-eyebrow">Conversations</span><small>{connections.length}</small></header>
          <div className="convo-list">
            {loadingConnections && <div className="conversation-loading">Loading partners…</div>}
            {!loadingConnections && connections.length === 0 && <div className="conversation-empty"><Icon name="message" size={20}/><strong>No conversations yet</strong><span>Accept a booking to begin messaging.</span></div>}
            {connections.map((connection) => <button type="button" key={connection.id} className={`convo-item ${userId === connection.id ? 'active' : ''}`} onClick={() => { setMessages([]); setUserId(connection.id); }}><span className="convo-avatar">{initials(connection.name)}</span><span className="convo-copy"><strong>{connection.name}</strong><small><i/> Active Partner</small></span></button>)}
          </div>
        </aside>

        <section className="chat-hub-workspace">
          {!activePartner ? <div className="chat-placeholder"><Icon name="message" size={24}/><strong>Select a conversation</strong><span>Choose an exchange partner from the rail.</span></div> : <>
            <header className="chat-hub-header"><i/><div><strong>{activePartner.name}</strong><small>Direct conversation</small></div></header>
            <div ref={scrollRef} className="chat-hub-stream" aria-live="polite">
              {loadingMessages && messages.length === 0 && <div className="chat-loading">Loading conversation…</div>}
              {!loadingMessages && messages.length === 0 && <div className="chat-placeholder compact"><strong>Start the conversation</strong><span>Share context about your upcoming exchange.</span></div>}
              {messages.map((message) => {
                const isMe = entityId(message.sender) === ownId;
                return <div key={message._id} className={`msg-bubble ${isMe ? 'msg-me' : 'msg-them'}`}><span>{message.body}</span><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>;
              })}
            </div>
            <div className="chat-input-wrapper"><form className="chat-command-bar" onSubmit={onSend}><label className="sr-only" htmlFor="message-body">Write a message</label><input id="message-body" className="foundry-input" placeholder={`Message ${activePartner.name}...`} value={body} onChange={(event) => setBody(event.target.value)} maxLength="2000" required/><button type="submit" className="primary-button" disabled={!body.trim() || sending}>{sending ? 'SENDING...' : 'SEND'}</button></form></div>
          </>}
        </section>
      </div>
    </AppShell>
  );
}

export default Messages;
