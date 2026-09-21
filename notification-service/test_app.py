import os
import unittest
from unittest.mock import patch

os.environ['NOTIFICATION_SERVICE_API_KEY'] = 'test-secret'
from app import app


class NotificationServiceTest(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_health_is_public(self):
        self.assertEqual(self.client.get('/').status_code, 200)

    def test_notify_requires_service_key(self):
        response = self.client.post('/notify', json={'type': 'BOOKING_CREATED', 'recipientEmail': 'a@example.com', 'data': {}})
        self.assertEqual(response.status_code, 401)

    @patch.dict(os.environ, {'RESEND_API_KEY': ''})
    def test_authorized_request_validates_email_provider_configuration(self):
        response = self.client.post('/notify', headers={'X-Notification-Key': 'test-secret'}, json={
            'type': 'BOOKING_CREATED', 'recipientEmail': 'a@example.com',
            'data': {'actor': 'A', 'skill': 'Guitar', 'time': 'tomorrow'}
        })
        self.assertEqual(response.status_code, 503)


if __name__ == '__main__':
    unittest.main()
