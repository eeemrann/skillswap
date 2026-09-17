import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setCredentials } from '../redux/authSlice';
import api from '../api/axios';

function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState('');
  const currentUser = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const dispatch = useDispatch();

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const res = await api.get('/bookings');
      setBookings(res.data);
    } catch (err) {
      setMessage('Failed to load bookings');
    }
  };

  const respondToBooking = async (id, status) => {
    try {
      await api.patch(`/bookings/${id}/status`, { status });
      fetchBookings(); // refresh the list after updating
    } catch (err) {
      setMessage(err.response?.data?.message || 'Action failed');
    }
  };

  const completeBooking = async (id) => {
    try {
      await api.patch(`/bookings/${id}/complete`);
      setMessage('Session completed — credits transferred!');
      fetchBookings();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Action failed');
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '50px auto' }}>
      <h2>My Bookings</h2>
      {message && <p>{message}</p>}

      {bookings.length === 0 && <p>No bookings yet. Go to Browse and request a skill!</p>}

      {bookings.map((b) => {
        // Figure out if the logged-in user is the requester or the provider for this booking
        const isProvider = b.provider._id === currentUser?._id;
        const isRequester = b.requester._id === currentUser?._id;

        return (
          <div key={b._id} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 10, borderRadius: 6 }}>
            <p><strong>Skill:</strong> {b.skill}</p>
            <p><strong>With:</strong> {isProvider ? b.requester.name : b.provider.name}</p>
            <p><strong>Your role:</strong> {isProvider ? 'Teaching' : 'Learning'}</p>
            <p><strong>Proposed time:</strong> {new Date(b.proposedTime).toLocaleString()}</p>
            <p><strong>Status:</strong> {b.status}</p>

            {/* Only the provider sees Accept/Decline, and only while pending */}
            {isProvider && b.status === 'pending' && (
              <>
                <button onClick={() => respondToBooking(b._id, 'accepted')}>Accept</button>
                <button onClick={() => respondToBooking(b._id, 'declined')} style={{ marginLeft: 8 }}>Decline</button>
              </>
            )}

            {/* Only the requester can mark it complete, and only once accepted */}
            {isRequester && b.status === 'accepted' && (
              <button onClick={() => completeBooking(b._id)}>Mark Session Complete</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default Bookings;