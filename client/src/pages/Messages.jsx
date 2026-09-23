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
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  const loadMessages = useCallback(async (targetId, silent = false, isActive = () => true) => {
    if (!targetId) return;
    try {
      if (!silent) setLoadingMessages(true);
      const { data } = await api.get(`/messages/${targetId}`);
      if (isActive()) { setMessages(data); setError(''); dispatch(fetchUnreadCounts()); }
    } catch (err) { if (isActive()) setError(err.response?.data?.message || 'Could not load this conversation.'); }
    finally { if (!silent && isActive()) setLoadingMessages(false); }
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
    }).catch((err) => active && setError(err.response?.data?.message || 'Could not load your exchange partners.'))
      .finally(() => active && setLoadingConnections(false));
    return () => { active = false; };
  }, [currentUser?._id, currentUser?.id]);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    queueMicrotask(() => active && loadMessages(userId, false, () => active));
    const refresh = () => { if (!document.hidden && active) loadMessages(userId, true, () => active); };
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [loadMessages, userId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (event) => {
    event.preventDefault();
    const cleanBody = body.trim();
    if (!cleanBody || !userId) return;
    try {
      await api.post(`/messages/${userId}`, { body: cleanBody });
      setBody(''); setError('');
      await loadMessages(userId, true);
    } catch (err) { setError(err.response?.data?.message || 'Message could not be sent.'); }
  };

  const activeConnection = connections.find((connection) => connection.id === userId);
  const ownId = currentUser?._id || currentUser?.id;

  return <AppShell eyebrow="Messenger" title="Direct exchange" description="Focused conversations with the people in your learning network.">
    {error && <p className="status-message error" role="alert">{error}</p>}
    <div className="communication-hub">
      <aside className="conversation-rail"><header><span>Conversations</span><small>{connections.length}</small></header><div className="conversation-rail-list">{loadingConnections && <div className="conversation-loading">Loading partners…</div>}{!loadingConnections && connections.length === 0 && <div className="conversation-empty"><Icon name="message" size={20}/><strong>No conversations yet</strong><span>Accept a booking to begin messaging.</span></div>}{connections.map((connection) => <button type="button" className={userId === connection.id ? 'active' : ''} key={connection.id} onClick={() => { setMessages([]); setUserId(connection.id); }}><span className="conversation-avatar">{initials(connection.name)}</span><span><strong>{connection.name}</strong><small><i/> Active partner</small></span></button>)}</div></aside>
      <section className="chat-workspace">{!userId ? <div className="chat-placeholder"><Icon name="message" size={24}/><strong>Select a conversation</strong><span>Choose an exchange partner from the sidebar.</span></div> : <><header className="chat-header"><span className="conversation-avatar">{initials(activeConnection?.name)}</span><div><strong>{activeConnection?.name || 'Exchange partner'}</strong><small>Direct conversation</small></div></header><div className="chat-stream" ref={scrollRef} aria-live="polite">{loadingMessages && messages.length === 0 && <div className="chat-loading">Loading conversation…</div>}{!loadingMessages && messages.length === 0 && <div className="chat-placeholder compact"><strong>Start the conversation</strong><span>Share context about your upcoming exchange.</span></div>}{messages.map((message) => { const isMine = entityId(message.sender) === ownId; return <div className={`chat-message ${isMine ? 'mine' : ''}`} key={message._id}><div>{message.body}</div><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>; })}</div><form className="command-composer" onSubmit={sendMessage}><label className="sr-only" htmlFor="message-body">Write a message</label><input id="message-body" value={body} onChange={(event) => setBody(event.target.value)} placeholder={`Message ${activeConnection?.name || 'your partner'}…`} maxLength="2000" required/><button className="primary-button" type="submit" disabled={!body.trim()}>Send <Icon name="arrow" size={14}/></button></form></>}</section>
    </div>
  </AppShell>;
}

export default Messages;
