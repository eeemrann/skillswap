import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

function EditSkills() {
  const [skillsOffered, setSkillsOffered] = useState('');
  const [skillsWanted, setSkillsWanted] = useState('');
  const [message, setMessage] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const res = await api.get('/users/me');

        if (!cancelled) {
          setSkillsOffered(
            (res.data.skillsOffered || []).join(', ')
          );

          setSkillsWanted(
            (res.data.skillsWanted || []).join(', ')
          );
        }
      } catch {
        if (!cancelled) {
          setMessage('Failed to load profile');
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      const offeredArray = skillsOffered
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const wantedArray = skillsWanted
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await api.put('/users/me/skills', {
        skillsOffered: offeredArray,
        skillsWanted: wantedArray
      });

      setMessage('Skills updated!');

      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (err) {
      setMessage(
        err.response?.data?.message || 'Update failed'
      );
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '50px auto' }}>
      <h2>Edit My Skills</h2>

      {message && <p>{message}</p>}

      <form onSubmit={handleSubmit}>
        <label>
          Skills I can teach (comma-separated):
        </label>

        <br />

        <input
          type="text"
          value={skillsOffered}
          onChange={(e) => setSkillsOffered(e.target.value)}
          placeholder="Guitar, Excel, Cooking"
          style={{ width: '100%' }}
        />

        <br />
        <br />

        <label>
          Skills I want to learn (comma-separated):
        </label>

        <br />

        <input
          type="text"
          value={skillsWanted}
          onChange={(e) => setSkillsWanted(e.target.value)}
          placeholder="Spanish, Photography"
          style={{ width: '100%' }}
        />

        <br />
        <br />

        <button type="submit">
          Save
        </button>
      </form>
    </div>
  );
}

export default EditSkills;