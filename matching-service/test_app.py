import unittest
from datetime import datetime, timezone
from app import app, availability_score, to_utc_intervals


class MatchingServiceTest(unittest.TestCase):
    def test_partially_overlapping_slots_match(self):
        self.assertTrue(availability_score(
            [{'day': 'monday', 'start': '09:00', 'end': '11:00'}],
            [{'day': 'monday', 'start': '10:30', 'end': '12:00'}]
        ))

    def test_match_endpoint(self):
        response = app.test_client().post('/match', json={
            'mySkillsWanted': ['Guitar'],
            'candidates': [{'id': '1', 'name': 'Teacher', 'skillsOffered': ['guitar']}]
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()[0]['id'], '1')

    def test_match_rejects_invalid_json_shape(self):
        response = app.test_client().post('/match', json={'candidates': ['not-an-object']})
        self.assertEqual(response.status_code, 400)

    def test_coordinates_within_25km_match(self):
        response = app.test_client().post('/match', json={
            'mySkillsWanted': ['Guitar'],
            'radiusKm': 25,
            'myLocation': {'coordinates': [90.4125, 23.8103]},
            'candidates': [{'id': 'near', 'name': 'Near', 'skillsOffered': ['guitar'],
                            'location': {'coordinates': [90.43, 23.81]}}]
        })
        self.assertEqual(response.get_json()[0]['matchReasons'][-1], 'Within 25km')

    def test_coordinates_over_25km_do_not_match_same_city(self):
        response = app.test_client().post('/match', json={
            'mySkillsWanted': ['Guitar'],
            'radiusKm': 25,
            'myLocation': {'city': 'Dhaka', 'coordinates': [90.4125, 23.8103]},
            'candidates': [{'id': 'far', 'name': 'Far', 'skillsOffered': ['guitar'],
                            'location': {'city': 'Dhaka', 'coordinates': [91.0, 24.0]}}]
        })
        self.assertEqual(response.get_json()[0]['score'], 1)
        self.assertNotIn('Same location', response.get_json()[0]['matchReasons'])

    def test_city_fallback_when_coordinates_missing(self):
        response = app.test_client().post('/match', json={
            'mySkillsWanted': ['Guitar'],
            'myLocation': {'city': 'Dhaka'},
            'candidates': [{'id': 'city', 'name': 'City', 'skillsOffered': ['guitar'],
                            'location': {'city': 'dhaka', 'coordinates': [90.4125, 23.8103]}}]
        })
        self.assertEqual(response.get_json()[0]['matchReasons'][-1], 'Same location')

    def test_radius_50_matches_candidate_that_radius_25_rejects(self):
        payload = {
            'mySkillsWanted': ['Guitar'],
            'myLocation': {'coordinates': [0, 0]},
            'candidates': [{'id': 'medium-distance', 'name': 'Medium distance', 'skillsOffered': ['guitar'],
                            'location': {'coordinates': [0.4, 0]}}]
        }
        radius_25 = app.test_client().post('/match', json={**payload, 'radiusKm': 25})
        radius_50 = app.test_client().post('/match', json={**payload, 'radiusKm': 50})
        self.assertEqual(radius_25.get_json()[0]['score'], 1)
        self.assertEqual(radius_50.get_json()[0]['score'], 1.25)
        self.assertIn('Within 50km', radius_50.get_json()[0]['matchReasons'])

    def test_worldwide_matches_coordinates_across_countries(self):
        response = app.test_client().post('/match', json={
            'mySkillsWanted': ['Guitar'],
            'myLocation': {'city': 'New York', 'coordinates': [-73.9857, 40.7484]},
            'radiusKm': 'worldwide',
            'candidates': [{'id': 'australia', 'name': 'Australia', 'skillsOffered': ['guitar'],
                            'location': {'city': 'Sydney', 'coordinates': [151.2093, -33.8688]}}]
        })
        self.assertEqual(response.get_json()[0]['score'], 1.25)
        self.assertIn('Worldwide', response.get_json()[0]['matchReasons'])

    def test_mutual_swap_is_rewarded(self):
        response = app.test_client().post('/match', json={
            'mySkillsWanted': ['Guitar'], 'mySkillsOffered': ['Design'],
            'candidates': [{'id': 'swap', 'name': 'Swap', 'skillsOffered': ['guitar'], 'skillsWanted': ['design']},
                           {'id': 'plain', 'name': 'Plain', 'skillsOffered': ['guitar'], 'skillsWanted': ['cooking']}]
        })
        results = {r['id']: r for r in response.get_json()}
        self.assertEqual(results['swap']['score'], 1.5)
        self.assertEqual(results['swap']['mutualSkills'], ['design'])
        self.assertIn('Wants to learn from you too', results['swap']['matchReasons'])
        self.assertEqual(results['plain']['score'], 1)
        self.assertEqual(response.get_json()[0]['id'], 'swap')

    def test_availability_is_compared_across_timezones(self):
        winter = datetime(2026, 1, 15, 12, tzinfo=timezone.utc)
        dhaka = [{'day': 'monday', 'start': '09:00', 'end': '10:00'}]
        # Monday 09:00 in Dhaka (UTC+6) is Sunday 22:00 in New York (UTC-5).
        self.assertTrue(availability_score(
            dhaka, [{'day': 'sunday', 'start': '22:00', 'end': '23:30'}], 'Asia/Dhaka', 'America/New_York', winter))
        self.assertFalse(availability_score(
            dhaka, [{'day': 'monday', 'start': '09:00', 'end': '10:00'}], 'Asia/Dhaka', 'America/New_York', winter))

    def test_slots_wrap_the_week_boundary(self):
        winter = datetime(2026, 1, 15, 12, tzinfo=timezone.utc)
        # Monday 01:00-03:00 in Dhaka is Sunday 19:00-21:00 UTC.
        self.assertEqual(to_utc_intervals([{'day': 'monday', 'start': '01:00', 'end': '03:00'}], 'Asia/Dhaka', winter),
                         [(6 * 1440 + 19 * 60, 6 * 1440 + 21 * 60)])

    def test_malformed_slots_and_unknown_zones_do_not_crash(self):
        self.assertEqual(to_utc_intervals([{'day': 'funday', 'start': '09:00', 'end': '10:00'}, {}, {'day': 'monday'}], 'Not/AZone'), [])
        self.assertFalse(availability_score('nope', None))


if __name__ == '__main__':
    unittest.main()
