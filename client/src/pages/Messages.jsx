import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';
import api from '../api/axios';

function Messages() {
  const [userId, setUserId] = useState('');
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const loadMessages = async () => { if (!userId) return; try { const res = await api.get(`/messages/${userId}`); setMessages(res.data); setMessage(''); } catch (err) { setMessage(err.response?.data?.message || 'Could not load messages.'); } };
  useEffect(() => { if (userId) { api.get(`/messages/${userId}`).then((res) => { setMessages(res.data); setMessage(''); }).catch((err) => setMessage(err.response?.data?.message || 'Could not load messages.')); } }, [userId]);
  const sendMessage = async (event) => { event.preventDefault(); try { await api.post(`/messages/${userId}`, { body }); setBody(''); loadMessages(); } catch (err) { setMessage(err.response?.data?.message || 'Message could not be sent.'); } };
  return <AppShell eyebrow="Your conversations" title="Keep the exchange human." description="Message people you are connected with through an accepted booking."><div className="content-grid two-column"><section className="surface surface-pad"><p className="section-kicker">Choose a conversation</p><div className="form-field"><label htmlFor="message-user">Member user ID</label><input id="message-user" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="Paste a connected member ID" /></div><button className="primary-button" type="button" onClick={loadMessages}>Open conversation</button></section><section className="surface surface-pad"><p className="section-kicker">Conversation</p>{message && <p className="status-message error">{message}</p>}{!message && messages.length === 0 && <div className="empty-state"><strong>No messages here yet</strong>Open a conversation with a booking connection.</div>}<div className="match-list">{messages.map((item) => <div className="match-card" key={item._id}><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div>)}</div>{userId && <form onSubmit={sendMessage} className="stack-actions"><input className="search-input" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message" required /><button className="primary-button" type="submit">Send</button></form>}</section></div></AppShell>;
}

export default Messages;
