import os
import unittest
from unittest.mock import patch, MagicMock

os.environ['NOTIFICATION_SERVICE_API_KEY'] = 'test-secret'
from app import app, render, format_time, credits_label, TEMPLATES

HEADERS = {'X-Notification-Key': 'test-secret'}


class NotificationServiceTest(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_health_is_public(self):
        self.assertEqual(self.client.get('/').status_code, 200)

    def test_notify_requires_service_key(self):
        response = self.client.post('/notify', json={'type': 'BOOKING_CREATED', 'recipientEmail': 'a@example.com', 'data': {}})
        self.assertEqual(response.status_code, 401)

    def test_rejects_wrong_key(self):
        response = self.client.post('/notify', headers={'X-Notification-Key': 'nope'}, json={})
        self.assertEqual(response.status_code, 401)

    def test_rejects_unknown_type_and_bad_data(self):
        self.assertEqual(self.client.post('/notify', headers=HEADERS, json={'type': 'NOPE', 'recipientEmail': 'a@b.co', 'data': {}}).status_code, 400)
        self.assertEqual(self.client.post('/notify', headers=HEADERS, json={'type': 'BOOKING_CREATED', 'recipientEmail': 'a@b.co', 'data': 'str'}).status_code, 400)

    def test_missing_template_field_is_a_client_error(self):
        response = self.client.post('/notify', headers=HEADERS, json={'type': 'BOOKING_CREATED', 'recipientEmail': 'a@b.co', 'data': {'actor': 'A'}})
        self.assertEqual(response.status_code, 400)
        self.assertIn('skill', response.get_json()['message'])

    @patch.dict(os.environ, {'RESEND_API_KEY': ''})
    def test_authorized_request_validates_email_provider_configuration(self):
        response = self.client.post('/notify', headers=HEADERS, json={
            'type': 'BOOKING_CREATED', 'recipientEmail': 'a@example.com',
            'data': {'actor': 'A', 'skill': 'Guitar', 'time': '2026-10-05T12:00:00Z'}
        })
        self.assertEqual(response.status_code, 503)

    @patch.dict(os.environ, {'RESEND_API_KEY': 'key', 'EMAIL_FROM': 'SkillSwap <hi@example.com>'})
    @patch('app.requests.post')
    def test_sends_text_and_html_through_resend(self, post):
        post.return_value = MagicMock(status_code=200)
        response = self.client.post('/notify', headers=HEADERS, json={
            'type': 'SESSION_REMINDER', 'recipientEmail': 'a@example.com',
            'data': {'actor': 'Sam', 'skill': 'Guitar', 'time': '2026-10-05T12:00:00Z', 'timezone': 'UTC', 'url': 'https://app.example.com/session/1'}
        })
        self.assertEqual(response.get_json(), {'delivered': True})
        sent = post.call_args.kwargs['json']
        self.assertEqual(sent['to'], ['a@example.com'])
        self.assertEqual(sent['from'], 'SkillSwap <hi@example.com>')
        self.assertIn('Join session: https://app.example.com/session/1', sent['text'])
        self.assertIn('href="https://app.example.com/session/1"', sent['html'])

    @patch.dict(os.environ, {'RESEND_API_KEY': 'key'})
    @patch('app.requests.post')
    def test_provider_rejection_is_reported_not_swallowed(self, post):
        post.return_value = MagicMock(status_code=422, text='bad')
        response = self.client.post('/notify', headers=HEADERS, json={
            'type': 'BOOKING_DECLINED', 'recipientEmail': 'a@example.com', 'data': {'actor': 'A', 'skill': 'Guitar'}})
        self.assertEqual(response.status_code, 502)
        self.assertFalse(response.get_json()['delivered'])


class RenderingTest(unittest.TestCase):
    def test_every_template_renders_with_realistic_data(self):
        data = {'actor': 'Sam', 'skill': 'React', 'time': '2026-10-05T12:00:00Z', 'credits': 1.5, 'amount': '9.00 USD', 'url': 'https://x.test/a',
                'name': 'Jane', 'code': '482913', 'minutes': 15, 'skills': 'Go, System Design', 'rate': '2', 'reason': 'Please link your staff page.'}
        for event_type in TEMPLATES:
            subject, text, html = render(event_type, data)
            self.assertTrue(subject and text and html, event_type)
            self.assertIn('https://x.test/a', html)

    def test_user_supplied_values_are_html_escaped(self):
        _, _, html = render('BOOKING_CREATED', {'actor': '<script>alert(1)</script>', 'skill': 'A & B', 'time': '2026-10-05T12:00:00Z', 'note': '<img src=x>'})
        self.assertNotIn('<script>', html)
        self.assertNotIn('<img', html)
        self.assertIn('&lt;script&gt;', html)
        self.assertIn('A &amp; B', html)

    def test_only_http_links_become_buttons(self):
        _, text, html = render('BOOKING_ACCEPTED', {'actor': 'A', 'skill': 'S', 'time': '2026-10-05T12:00:00Z', 'url': 'javascript:alert(1)'})
        self.assertNotIn('javascript:', html)
        self.assertNotIn('javascript:', text)

    def test_times_are_shown_in_the_recipients_timezone(self):
        self.assertEqual(format_time('2026-10-05T12:00:00Z', 'UTC'), 'Mon 05 Oct 2026, 12:00 (UTC)')
        self.assertEqual(format_time('2026-10-05T12:00:00Z', 'Asia/Dhaka'), 'Mon 05 Oct 2026, 18:00 (Asia/Dhaka)')
        self.assertEqual(format_time('2026-10-05T12:00:00Z', 'Not/AZone'), 'Mon 05 Oct 2026, 12:00 (UTC)')
        self.assertEqual(format_time('garbage', 'UTC'), 'garbage')

    def test_teacher_verification_code_email_shows_the_code_and_expiry(self):
        subject, text, html = render('TEACHER_EMAIL_CODE', {'code': '482913', 'minutes': 15})
        self.assertIn('482913', subject)
        self.assertIn('Your verification code is 482913', text)
        self.assertIn('15 minutes', text)
        self.assertNotIn('href=', html)  # a code email has no button to click

    def test_teacher_decisions_carry_the_reviewer_note_escaped(self):
        _, text, html = render('TEACHER_REJECTED', {'reason': '<b>Link</b> your staff page', 'url': 'https://x.test/teach'})
        self.assertIn('Link', text)
        self.assertNotIn('<b>', html)
        self.assertIn('&lt;b&gt;Link&lt;/b&gt;', html)
        subject, text, _ = render('TEACHER_APPROVED', {'name': 'Jane', 'skills': 'Go', 'rate': '2'})
        self.assertIn('verified', subject)
        self.assertIn('Congratulations, Jane', text)
        self.assertIn('2 credits per hour', text)

    def test_payout_emails_state_the_money_and_the_outcome(self):
        _, text, _ = render('PAYOUT_SENT', {'credits': 4, 'amount': '32.00 USD'})
        self.assertIn('32.00 USD for 4 credits', text)
        _, text, _ = render('PAYOUT_FAILED', {'credits': 4, 'reason': 'Declined after review'})
        self.assertIn('back in your wallet', text)
        self.assertIn('Declined after review', text)

    def test_missing_fields_are_reported_for_the_new_templates(self):
        for event_type in ('TEACHER_EMAIL_CODE', 'TEACHER_APPROVED', 'TEACHER_REJECTED', 'PAYOUT_SENT', 'PAYOUT_FAILED'):
            with self.assertRaises(KeyError):
                render(event_type, {})

    def test_credit_labels_pluralise(self):
        self.assertEqual(credits_label(1), '1 credit')
        self.assertEqual(credits_label(1.5), '1.5 credits')
        self.assertEqual(credits_label(10), '10 credits')


if __name__ == '__main__':
    unittest.main()
