import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import { errorMessage, formatRelative, formatTime, idOf } from '../lib/format';
import { useQuery, useWindowEvent } from '../lib/hooks';
import { fetchUnreadCounts } from '../redux/notificationSlice';

function Thread({ partner, myId, onBack }) {
  const dispatch = useDispatch();
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const thread = useQuery(async () => {
    const { data } = await api.get(`/messages/${partner._id}`);
    dispatch(fetchUnreadCounts());
    return data;
  }, [partner._id], { interval: 20000 });
  useWindowEvent('skillswap:message', () => thread.reload());

  const messages = thread.data || [];
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages.length, partner._id]);

  const send = async (event) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError('');
    try {
      const { data } = await api.post(`/messages/${partner._id}`, { body: text });
      setBody('');
      thread.setData((current) => [...(current || []), data]);
    } catch (err) {
      setError(errorMessage(err, 'Message could not be sent.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="thread card">
      <header className="thread-head">
        <button type="button" className="btn btn-ghost btn-icon btn-sm only-mobile" onClick={onBack} aria-label="Back to conversations"><Icon name="arrowLeft" /></button>
        <Link to={`/profile/${partner._id}`} className="row nowrap" style={{ gap: 12, color: 'inherit' }}>
          <Avatar name={partner.name} src={partner.profilePicture} />
          <div className="stack" style={{ '--gap': '0px' }}><strong>{partner.name}</strong><span className="tiny faint">{partner.skill}</span></div>
        </Link>
        <div className="grow" />
        <Link className="btn btn-secondary btn-sm" to="/bookings"><Icon name="video" size={15} /> Sessions</Link>
      </header>
      <div className="thread-body" ref={scrollRef} aria-live="polite">
        {thread.loading && <div className="skeleton" style={{ height: 48, width: '60%' }} />}
        {!thread.loading && messages.length === 0 && <EmptyState icon="message" title="Say hello">Agree on what to cover and when to meet. Messages are private to the two of you.</EmptyState>}
        {messages.map((message) => (
          <div key={message._id} className={`bubble ${message.sender === myId ? 'mine' : ''}`}><p>{message.body}</p><time>{formatTime(message.createdAt)}</time></div>
        ))}
      </div>
      <form className="thread-compose" onSubmit={send}>
        {error && <span className="tiny negative-text">{error}</span>}
        <input className="input" value={body} onChange={(event) => setBody(event.target.value)} placeholder={`Message ${partner.name.split(' ')[0]}…`} maxLength={2000} aria-label="Message" />
        <button type="submit" className="btn btn-primary" disabled={!body.trim() || sending}><Icon name="send" size={16} /><span className="hide-mobile">Send</span></button>
      </form>
    </section>
  );
}

export default function Messages() {
  const user = useSelector((state) => state.auth.user);
  const myId = idOf(user);
  const [params, setParams] = useSearchParams();
  const requested = params.get('with') || '';
  const [picked, setPicked] = useState(null);

  const conversations = useQuery(() => api.get('/messages/conversations').then((r) => r.data), [], { interval: 30000 });
  useWindowEvent('skillswap:message', () => conversations.reload());

  const list = conversations.data || [];
  const activeId = picked ?? (requested || list[0]?._id || '');
  const active = list.find((item) => item._id === activeId);
  const showThread = Boolean(active && (picked !== null || requested));

  const choose = (id) => { setPicked(id); setParams(id ? { with: id } : {}, { replace: true }); };

  return (
    <AppShell eyebrow="Messages" title="Conversations" description="Chat with members you have a confirmed session with." wide>
      {conversations.loading ? <div className="skeleton" style={{ height: 420 }} /> : list.length === 0 ? (
        <div className="card"><EmptyState icon="message" title="No conversations yet" action={<Link className="btn btn-primary" to="/browse">Find a teacher</Link>}>You can message someone once a session between you has been confirmed.</EmptyState></div>
      ) : (
        <div className={`messenger ${showThread ? 'show-thread' : ''}`}>
          <aside className="conversations card" aria-label="Conversations">
            {list.map((item) => (
              <button type="button" key={item._id} className={`conversation ${item._id === active?._id ? 'active' : ''}`} onClick={() => choose(item._id)}>
                <Avatar name={item.name} src={item.profilePicture} />
                <span className="grow stack" style={{ '--gap': '1px', textAlign: 'left', minWidth: 0 }}>
                  <span className="row spread nowrap"><strong className="truncate">{item.name}</strong>{item.lastMessage && <span className="tiny faint">{formatRelative(item.lastMessage.createdAt)}</span>}</span>
                  <span className="small muted truncate">{item.lastMessage ? `${item.lastMessage.sender === myId ? 'You: ' : ''}${item.lastMessage.body}` : item.skill}</span>
                </span>
                {item.unread > 0 && <span className="count-badge">{item.unread}</span>}
              </button>
            ))}
          </aside>
          {active ? <Thread key={active._id} partner={active} myId={myId} onBack={() => { setPicked(''); setParams({}, { replace: true }); }} />
            : <section className="thread card"><EmptyState icon="message" title="Select a conversation" /></section>}
        </div>
      )}
    </AppShell>
  );
}
