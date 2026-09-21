import os
import hmac
import requests
from flask import Flask, jsonify, request
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)


def authorized(req):
    expected = os.getenv("NOTIFICATION_SERVICE_API_KEY", "")
    supplied = req.headers.get("X-Notification-Key", "")
    return bool(expected) and hmac.compare_digest(expected, supplied)


TEMPLATES = {
    "EMAIL_VERIFICATION": (
        "Verify your SkillSwap email",
        "Hi {actor},\n\n"
        "Your SkillSwap verification code is {code}. "
        "It expires in {minutes} minutes.\n\n"
        "If you did not create this account, you can ignore this email."
    ),

    "BOOKING_CREATED": (
        "New SkillSwap request",
        "{actor} requested a {skill} exchange for {time}."
    ),

    "BOOKING_ACCEPTED": (
        "Your SkillSwap request was accepted",
        "{actor} accepted your {skill} exchange for {time}."
    ),

    "BOOKING_DECLINED": (
        "Your SkillSwap request was declined",
        "{actor} declined your {skill} exchange request."
    ),

    "BOOKING_COMPLETED": (
        "Your SkillSwap exchange is complete",
        "Your {skill} exchange is complete. Your time credits have been transferred."
    ),
}


@app.get("/")
def health():
    return jsonify({
        "status": "Notification service is running"
    })


@app.post("/notify")
def notify():

    if not authorized(request):
        return jsonify({
            "message": "Unauthorized"
        }), 401


    payload = request.get_json(silent=True) or {}

    event_type = payload.get("type")
    recipient = payload.get("recipientEmail")
    data = payload.get("data", {})


    if event_type not in TEMPLATES or not recipient:
        return jsonify({
            "message": "type and recipientEmail are required"
        }), 400


    subject_template, body_template = TEMPLATES[event_type]


    try:
        body = body_template.format(**data)

    except KeyError as error:
        app.logger.error(
            "Missing template field: %s",
            error
        )

        return jsonify({
            "delivered": False,
            "message": f"Missing template field: {error.args[0]}"
        }), 400



    resend_api_key = os.getenv("RESEND_API_KEY")
    email_from = os.getenv(
        "EMAIL_FROM",
        "onboarding@resend.dev"
    )


    if not resend_api_key:
        app.logger.error(
            "RESEND_API_KEY missing"
        )

        return jsonify({
            "delivered": False,
            "message": "Email provider is not configured"
        }), 503



    try:

        response = requests.post(
            "https://api.resend.com/emails",

            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json"
            },

            json={
                "from": email_from,
                "to": [
                    recipient
                ],
                "subject": subject_template,
                "text": body
            },

            timeout=10
        )


        if response.status_code >= 400:

            app.logger.error(
                "Resend rejected email: %s %s",
                response.status_code,
                response.text
            )

            return jsonify({
                "delivered": False,
                "message": "Email provider rejected the delivery"
            }), 502



        app.logger.info(
            "Email delivered: %s -> %s",
            event_type,
            recipient
        )


        return jsonify({
            "delivered": True
        })


    except requests.RequestException:

        app.logger.exception(
            "Resend request failed"
        )

        return jsonify({
            "delivered": False,
            "message": "Email provider unavailable"
        }), 502



if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "7000"))
    )