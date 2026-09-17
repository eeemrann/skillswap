import { useEffect, useState } from 'react';
import api from '../api/axios';

function Browse() {
const [users, setUsers] = useState([]);
const [error, setError] = useState('');
const [loading, setLoading] = useState(true);
const [bookingForm, setBookingForm] = useState(null);
const [proposedTime, setProposedTime] = useState('');
const [message, setMessage] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
  try {
    setLoading(true);

    const res = await api.get('/users');
    setUsers(res.data);

  } catch (err) {
    setError('Unable to load users. Please try again.');

  } finally {
    setLoading(false);
  }
};

  const openBookingForm = (providerId, skill) => {
    setBookingForm({ providerId, skill });
    setMessage('');
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    try {
      await api.post('/bookings', {
        providerId: bookingForm.providerId,
        skill: bookingForm.skill,
        proposedTime
      });
      setMessage('Request sent!');
      setBookingForm(null);
      setProposedTime('');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to send request');
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '50px auto' }}>
      <h2>Browse Skills</h2>
      {loading && <p>Loading users...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p>{message}</p>}

      {!loading && users.length === 0 && (
  <p>No other users yet. Register a second account to test this!</p>
)}
      {!loading && users.map((u) => (
        <div key={u._id} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 10, borderRadius: 6 }}>
          <h4>{u.name}</h4>
          <p><strong>Offers:</strong> {u.skillsOffered?.length ? u.skillsOffered.join(', ') : 'Nothing listed yet'}</p>
          <p><strong>Wants:</strong> {u.skillsWanted?.length ? u.skillsWanted.join(', ') : 'Nothing listed yet'}</p>

          {u.skillsOffered?.map((skill) => (
            <button key={skill} onClick={() => openBookingForm(u._id, skill)} style={{ marginRight: 6 }}>
              Request "{skill}"
            </button>
          ))}
        </div>
      ))}

      {bookingForm && (
        <div style={{ border: '2px solid #333', padding: 16, marginTop: 20 }}>
          <h4>Request "{bookingForm.skill}"</h4>
          <form onSubmit={submitBooking}>
            <label>Proposed date/time: </label>
            <input
              type="datetime-local"
              value={proposedTime}
              onChange={(e) => setProposedTime(e.target.value)}
              required
            />
            <br /><br />
            <button type="submit">Send Request</button>
            <button type="button" onClick={() => setBookingForm(null)} style={{ marginLeft: 8 }}>Cancel</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default Browse;