import os
import smtplib
from email.message import EmailMessage
from flask import Flask, jsonify, request

app = Flask(__name__)

TEMPLATES = {
    'BOOKING_CREATED': ('New SkillSwap request', '{actor} requested a {skill} exchange for {time}.'),
    'BOOKING_ACCEPTED': ('Your SkillSwap request was accepted', '{actor} accepted your {skill} exchange for {time}.'),
    'BOOKING_DECLINED': ('Your SkillSwap request was declined', '{actor} declined your {skill} exchange request.'),
    'BOOKING_COMPLETED': ('Your SkillSwap exchange is complete', 'Your {skill} exchange is complete. Your time credits have been transferred.'),
}

@app.get('/')
def health():
    return jsonify({'status': 'Notification service is running'})

@app.post('/notify')
def notify():
    payload = request.get_json(silent=True) or {}
    event_type = payload.get('type')
    recipient = payload.get('recipientEmail')
    data = payload.get('data', {})
    if event_type not in TEMPLATES or not recipient:
        return jsonify({'message': 'type and recipientEmail are required'}), 400

    subject_template, body_template = TEMPLATES[event_type]
    subject = subject_template
    body = body_template.format(**data)
    smtp_host = os.getenv('SMTP_HOST')
    smtp_user = os.getenv('SMTP_USER')
    smtp_password = os.getenv('SMTP_PASSWORD')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    sender = os.getenv('EMAIL_FROM', smtp_user)

    if not all([smtp_host, smtp_user, smtp_password, sender]):
        app.logger.warning('SMTP is not configured; skipped email for %s', event_type)
        return jsonify({'delivered': False, 'reason': 'SMTP is not configured'})

    message = EmailMessage()
    message['Subject'] = subject
    message['From'] = sender
    message['To'] = recipient
    message.set_content(body)
    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(message)
    return jsonify({'delivered': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '7000')))
