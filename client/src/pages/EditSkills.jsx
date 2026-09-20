import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import api from '../api/axios';
import AppShell from '../components/AppShell';


function EditSkills() {

  const [form, setForm] = useState({
    skillsOffered: '',
    skillsWanted: '',
    bio: '',
    city: '',
    country: '',
    timezone: 'UTC',
    availability: ''
  });


  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const navigate = useNavigate();



  const parseAvailability = (text) => {

    const dayNames = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    ];


    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;


    const entries = text
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);


    const slots = [];
    const errors = [];



    for (const entry of entries) {


      const match = entry.match(
        /^(\w+)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/
      );



      if (!match) {

        errors.push(
          `"${entry}" isn't in the format "day HH:MM-HH:MM", e.g. "monday 18:00-20:00"`
        );

        continue;

      }



      const [, day, start, end] = match;


      const dayLower = day.toLowerCase();



      if (!dayNames.includes(dayLower)) {

        errors.push(
          `"${day}" isn't a valid day name`
        );

        continue;

      }



      if (!timePattern.test(start) || !timePattern.test(end)) {

        errors.push(
          `"${entry}" needs 24-hour times like 18:00, not 6pm`
        );

        continue;

      }



      slots.push({
        day: dayLower,
        start,
        end
      });


    }



    return {
      slots,
      errors
    };

  };





  useEffect(() => {

    let cancelled = false;



    api.get('/users/me')
      .then((res) => {

        if (!cancelled) {

          const profile = res.data;


          setForm({

            skillsOffered:
              (profile.skillsOffered || []).join(', '),


            skillsWanted:
              (profile.skillsWanted || []).join(', '),


            bio:
              profile.bio || '',


            city:
              profile.location?.city || '',


            country:
              profile.location?.country || '',


            timezone:
              profile.timezone || 'UTC',


            availability:
              (profile.availability || [])
                .map(
                  (slot) =>
                    `${slot.day} ${slot.start}-${slot.end}`
                )
                .join(', ')

          });

        }


      })
      .catch(() => {

        if (!cancelled) {

          setMessage('Failed to load profile');

        }

      });



    return () => {

      cancelled = true;

    };


  }, []);





  const update = (key, value) => {

    setForm((current) => ({

      ...current,

      [key]: value

    }));

  };







  const handleSubmit = async (event) => {

    event.preventDefault();


    setMessage('');



    const { slots, errors } = parseAvailability(
      form.availability
    );



    if (errors.length > 0) {

      setMessage(errors[0]);

      return;

    }



    setIsSaving(true);



    try {


      await Promise.all([


        api.put('/users/me/skills', {


          skillsOffered:
            form.skillsOffered
              .split(',')
              .map((skill) => skill.trim())
              .filter(Boolean),



          skillsWanted:
            form.skillsWanted
              .split(',')
              .map((skill) => skill.trim())
              .filter(Boolean)


        }),





        api.put('/users/me/profile', {


          bio: form.bio,


          timezone: form.timezone,


          location: {

            city: form.city,

            country: form.country

          },


          availability: slots


        })


      ]);



      setMessage('Profile updated!');



      setTimeout(() => {

        navigate('/dashboard');

      }, 900);



    } catch (err) {


      setMessage(
        err.response?.data?.message ||
        'Update failed'
      );


    } finally {


      setIsSaving(false);


    }


  };







  return (

    <AppShell

      eyebrow="Your skill profile"

      title="Shape your exchange."

      description="Tell the community what you can share, where you are, and when you are available."

    >



      <div className="surface form-card">


        <p className="section-kicker">
          Your public profile
        </p>




        {message && (

          <p className="status-message">
            {message}
          </p>

        )}






        <form onSubmit={handleSubmit}>


          <div className="form-field">


            <label htmlFor="bio">
              Short bio
            </label>


            <textarea

              id="bio"

              value={form.bio}

              onChange={(event) =>
                update('bio', event.target.value)
              }

              placeholder="What are you curious about?"

            />


          </div>






          <div className="form-field">


            <label htmlFor="skills-offered">
              Skills I can teach
            </label>


            <input

              id="skills-offered"

              value={form.skillsOffered}

              onChange={(event) =>
                update('skillsOffered', event.target.value)
              }

              placeholder="Guitar, Excel, Cooking"

            />


          </div>







          <div className="form-field">


            <label htmlFor="skills-wanted">
              Skills I want to learn
            </label>


            <input

              id="skills-wanted"

              value={form.skillsWanted}

              onChange={(event) =>
                update('skillsWanted', event.target.value)
              }

              placeholder="Spanish, Photography"

            />


          </div>








          <div className="content-grid two-column">


            <div className="form-field">


              <label htmlFor="city">
                City
              </label>


              <input

                id="city"

                value={form.city}

                onChange={(event) =>
                  update('city', event.target.value)
                }

                placeholder="Dhaka"

              />


            </div>





            <div className="form-field">


              <label htmlFor="country">
                Country
              </label>


              <input

                id="country"

                value={form.country}

                onChange={(event) =>
                  update('country', event.target.value)
                }

                placeholder="Bangladesh"

              />


            </div>


          </div>







          <div className="form-field">


            <label htmlFor="timezone">
              Timezone
            </label>


            <input

              id="timezone"

              value={form.timezone}

              onChange={(event) =>
                update('timezone', event.target.value)
              }

              placeholder="Asia/Dhaka"

            />


          </div>







          <div className="form-field">


            <label htmlFor="availability">
              Availability
            </label>


            <input

              id="availability"

              value={form.availability}

              onChange={(event) =>
                update('availability', event.target.value)
              }

              placeholder="monday 18:00-20:00, saturday 10:00-12:00"

            />



            <span className="form-hint">

              Format: day HH:MM-HH:MM (24-hour), separated by commas.

            </span>


          </div>







          <div className="stack-actions">


            <button

              className="primary-button"

              type="submit"

              disabled={isSaving}

            >

              {isSaving ? 'Saving...' : 'Save profile'}

              <span>
                →
              </span>

            </button>





            <button

              className="secondary-button"

              type="button"

              onClick={() => navigate('/dashboard')}

            >

              Cancel

            </button>


          </div>





        </form>


      </div>



    </AppShell>

  );

}



export default EditSkills;