import os
import smtplib
import ssl
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
    try:
        body = body_template.format(**data)
    except KeyError as error:
        app.logger.error('Email template data missing for %s: %s', event_type, error)
        return jsonify({'delivered': False, 'message': f'Missing template field: {error.args[0]}'}), 400
    smtp_host = os.getenv('SMTP_HOST')
    smtp_user = os.getenv('SMTP_USER')
    smtp_password = os.getenv('SMTP_PASSWORD')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    sender = os.getenv('EMAIL_FROM', smtp_user)
    smtp_secure = os.getenv('SMTP_SECURE', 'starttls').strip().lower()

    if not all([smtp_host, smtp_user, smtp_password, sender]):
        app.logger.error('SMTP is not configured; email not sent for %s to %s', event_type, recipient)
        return jsonify({'delivered': False, 'message': 'SMTP is not configured'}), 503

    message = EmailMessage()
    message['Subject'] = subject
    message['From'] = sender
    message['To'] = recipient
    message.set_content(body)
    try:
        context = ssl.create_default_context()
        if smtp_secure == 'ssl':
            server_context = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20, context=context)
        else:
            server_context = smtplib.SMTP(smtp_host, smtp_port, timeout=20)
        with server_context as server:
            if smtp_secure == 'starttls':
                server.starttls(context=context)
            server.login(smtp_user, smtp_password)
            server.send_message(message)
        app.logger.info('Email delivered: type=%s recipient=%s', event_type, recipient)
        return jsonify({'delivered': True})
    except (smtplib.SMTPException, OSError) as error:
        app.logger.exception('SMTP delivery failed: type=%s recipient=%s', event_type, recipient)
        return jsonify({'delivered': False, 'message': str(error)}), 502

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '7000')))
