import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import api from '../api/axios';
import { fetchUnreadCounts, markNotificationTypeRead } from '../redux/notificationSlice';

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
  const [message, setMessage] = useState('');

  const loadMessages = useCallback(async (targetUserId) => {
    const id = targetUserId || userId;
    if (!id) return;
    try { setLoadingMessages(true); const res = await api.get(`/messages/${id}`); setMessages(res.data); setMessage(''); }
    catch (err) { setMessage(err.response?.data?.message || 'Could not load messages.'); }
    finally { setLoadingMessages(false); }
  }, [userId]);

  useEffect(() => {
    dispatch(markNotificationTypeRead('message'));
    let active = true;
    api.get('/bookings').then((res) => {
      if (!active) return;
      const connected = new Map();
      res.data.filter((booking) => ['accepted', 'completed'].includes(booking.status)).forEach((booking) => {
        const ownId = currentUser?._id || currentUser?.id;
        const other = booking.provider?._id === ownId ? booking.requester : booking.requester?._id === ownId ? booking.provider : null;
        if (other?._id) connected.set(other._id, { id: other._id, name: other.name || 'Member' });
      });
      const list = Array.from(connected.values());
      setConnections(list); setUserId((current) => current || list[0]?.id || '');
    }).catch((err) => { if (active) setMessage(err.response?.data?.message || 'Could not load your booking connections.'); })
      .finally(() => { if (active) setLoadingConnections(false); });
    return () => { active = false; };
  }, [currentUser?._id, currentUser?.id, dispatch]);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    queueMicrotask(() => { if (active) setLoadingMessages(true); });
    api.get(`/messages/${userId}`).then((res) => { if (active) { setMessages(res.data); setMessage(''); } })
      .catch((err) => { if (active) setMessage(err.response?.data?.message || 'Could not load messages.'); })
      .finally(() => { if (active) setLoadingMessages(false); });
    return () => { active = false; };
  }, [userId]);

  const sendMessage = async (event) => {
    event.preventDefault(); const cleanBody = body.trim(); if (!cleanBody) return;
    try { await api.post(`/messages/${userId}`, { body: cleanBody }); setBody(''); await loadMessages(userId); setMessage('Message sent.'); dispatch(fetchUnreadCounts()); }
    catch (err) { setMessage(err.response?.data?.message || 'Message could not be sent.'); }
  };

  return (
    <AppShell eyebrow="Your conversations" title="Keep the exchange human." description="Message people you are connected with through an accepted booking.">
      <div className="messages-layout surface">
        <aside className="conversation-list"><p className="section-kicker">Conversations</p>
          {loadingConnections && <p className="form-hint">Loading connected members...</p>}
          {!loadingConnections && connections.length === 0 && <div className="empty-state"><strong>No conversations yet</strong>Accept a booking to start messaging.</div>}
          {connections.map((connection) => <button key={connection.id} type="button" className={`conversation-person ${userId === connection.id ? 'active' : ''}`} onClick={() => setUserId(connection.id)}><span className="avatar">{connection.name.slice(0, 2).toUpperCase()}</span><span><strong>{connection.name}</strong><small>SkillSwap member</small></span></button>)}
        </aside>
        <section className="conversation-panel">
          {message && <p className={`status-message ${message === 'Message sent.' ? '' : 'error'}`} role="status">{message}</p>}
          {!userId ? <div className="empty-state"><strong>Select a conversation</strong>Choose a member to start chatting.</div> : <>
            <div className="message-stream" aria-live="polite">
              {loadingMessages && <p className="form-hint">Loading conversation...</p>}
              {!loadingMessages && messages.length === 0 && <div className="empty-state"><strong>No messages yet</strong>Say hello to start the conversation.</div>}
              {messages.map((item) => { const ownId = currentUser?._id || currentUser?.id; return <div className={`message-bubble ${item.sender === ownId || item.sender?._id === ownId ? 'mine' : ''}`} key={item._id}><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div>; })}
            </div>
            <form onSubmit={sendMessage} className="message-composer"><label className="sr-only" htmlFor="message-body">Write a message</label><input id="message-body" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message..." maxLength="2000" required /><button className="primary-button" type="submit" disabled={!body.trim()}>Send</button></form>
          </>}
        </section>
      </div>
    </AppShell>
  );
}

export default Messages;
