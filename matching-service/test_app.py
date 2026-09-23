import unittest
from app import app, availability_score


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
            'myLocation': {'coordinates': [90.4125, 23.8103]},
            'candidates': [{'id': 'near', 'name': 'Near', 'skillsOffered': ['guitar'],
                            'location': {'coordinates': [90.43, 23.81]}}]
        })
        self.assertEqual(response.get_json()[0]['matchReasons'][-1], 'Within 25km')

    def test_coordinates_over_25km_do_not_match_same_city(self):
        response = app.test_client().post('/match', json={
            'mySkillsWanted': ['Guitar'],
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


if __name__ == '__main__':
    unittest.main()
