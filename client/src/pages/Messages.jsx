import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import AppShell from '../components/AppShell';
import api from '../api/axios';
import { useSearchParams } from 'react-router-dom';


function Messages() {
  const currentUser = useSelector((state) => state.auth.user);
  const [connections, setConnections] = useState([]);
  const [userId, setUserId] = useState('');
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
<<<<<<< HEAD

  const loadMessages = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) return;
    try {
      setLoadingMessages(true);
      const res = await api.get(`/messages/${targetUserId}`);
      setMessages(res.data);
      setMessage('');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not load messages.');
    } finally {
      setLoadingMessages(false);
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const loadConnections = async () => {
      try {
        const res = await api.get('/bookings');
        if (cancelled) return;

        const connected = new Map();
        res.data
          .filter((booking) => ['accepted', 'completed'].includes(booking.status))
          .forEach((booking) => {
            const isProvider = booking.provider?._id === currentUser?.id;
            const isRequester = booking.requester?._id === currentUser?.id;
            if (!isProvider && !isRequester) return;

            const other = isProvider ? booking.requester : booking.provider;
            if (other?._id && !connected.has(other._id)) {
              connected.set(other._id, { id: other._id, name: other.name || 'Member' });
            }
          });

        const list = Array.from(connected.values());
        setConnections(list);
        if (list.length > 0) setUserId((current) => current || list[0].id);
      } catch (err) {
        if (!cancelled) setMessage(err.response?.data?.message || 'Could not load your booking connections.');
      } finally {
        if (!cancelled) setLoadingConnections(false);
      }
    };

    loadConnections();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const sendMessage = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/messages/${userId}`, { body });
      setBody('');
      await loadMessages();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Message could not be sent.');
    }
  };

  return <AppShell eyebrow="Your conversations" title="Keep the exchange human." description="Message people you are connected with through an accepted booking."><div className="content-grid two-column"><section className="surface surface-pad"><p className="section-kicker">Choose a conversation</p>{loadingConnections ? <p className="form-hint">Loading connected members…</p> : <div className="form-field"><label htmlFor="message-user">Connected member</label><select id="message-user" value={userId} onChange={(event) => { setUserId(event.target.value); setMessages([]); setMessage(''); }}><option value="">Select a member</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}</select></div>}{!loadingConnections && connections.length === 0 && <div className="empty-state"><strong>No conversations available</strong>You can message members after a booking is accepted.</div>}<button className="primary-button" type="button" onClick={() => loadMessages()} disabled={!userId || loadingConnections || loadingMessages}>Open conversation</button></section><section className="surface surface-pad"><p className="section-kicker">Conversation</p>{message && <p className="status-message error">{message}</p>}{loadingMessages && <p className="form-hint">Loading conversation…</p>}{!loadingMessages && !message && userId && messages.length === 0 && <div className="empty-state"><strong>No messages here yet</strong>Say hello to start your conversation.</div>}{!loadingMessages && !userId && <div className="empty-state"><strong>Select a connected member</strong>Pick someone from your accepted bookings to start messaging.</div>}<div className="match-list">{messages.map((item) => <div className="match-card" key={item._id}><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div>)}</div>{userId && <form onSubmit={sendMessage} className="stack-actions"><input className="search-input" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message" required /><button className="primary-button" type="submit">Send</button></form>}</section></div></AppShell>;
=======
  const loadMessages = async () => { if (!userId) return; try { const res = await api.get(`/messages/${userId}`); setMessages(res.data); setMessage(''); } catch (err) { setMessage(err.response?.data?.message || 'Could not load messages.'); } };
  useEffect(() => { if (userId) { api.get(`/messages/${userId}`).then((res) => { setMessages(res.data); setMessage(''); }).catch((err) => setMessage(err.response?.data?.message || 'Could not load messages.')); } }, [userId]);
  const [searchParams] = useSearchParams();
  useEffect(() => {
  const prefill = searchParams.get('with');
  if (prefill) setUserId(prefill);
  }, [searchParams]);
  const sendMessage = async (event) => { event.preventDefault(); try { await api.post(`/messages/${userId}`, { body }); setBody(''); loadMessages(); } catch (err) { setMessage(err.response?.data?.message || 'Message could not be sent.'); } };
  return <AppShell eyebrow="Your conversations" title="Keep the exchange human." description="Message people you are connected with through an accepted booking."><div className="content-grid two-column"><section className="surface surface-pad"><p className="section-kicker">Choose a conversation</p><div className="form-field"><label htmlFor="message-user">Member user ID</label><input id="message-user" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="Paste a connected member ID" /></div><button className="primary-button" type="button" onClick={loadMessages}>Open conversation</button></section><section className="surface surface-pad"><p className="section-kicker">Conversation</p>{message && <p className="status-message error">{message}</p>}{!message && messages.length === 0 && <div className="empty-state"><strong>No messages here yet</strong>Open a conversation with a booking connection.</div>}<div className="match-list">{messages.map((item) => <div className="match-card" key={item._id}><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div>)}</div>{userId && <form onSubmit={sendMessage} className="stack-actions"><input className="search-input" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message" required /><button className="primary-button" type="submit">Send</button></form>}</section></div></AppShell>;
>>>>>>> 79dc025 (feat: complete reviews UI, fix message ID validation, add admin bootstrap script)
}

export default Messages;
