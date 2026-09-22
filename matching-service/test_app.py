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


if __name__ == '__main__':
    unittest.main()
