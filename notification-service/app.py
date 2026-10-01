import os
import hmac
from datetime import datetime
from html import escape
from zoneinfo import ZoneInfo

import requests
from flask import Flask, jsonify, request
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

BRAND = "SkillSwap"
ACCENT = "#5b5bf0"


def authorized(req):
    expected = os.getenv("NOTIFICATION_SERVICE_API_KEY", "")
    supplied = req.headers.get("X-Notification-Key", "")
    return bool(expected) and hmac.compare_digest(expected, supplied)


def format_time(value, tz_name):
    """Renders an ISO timestamp in the recipient's timezone, e.g. "Mon 5 Oct 2026, 18:00 (Asia/Dhaka)"."""
    try:
        moment = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return str(value)
    try:
        zone = ZoneInfo(tz_name or "UTC")
        label = tz_name or "UTC"
    except Exception:
        zone, label = ZoneInfo("UTC"), "UTC"
    return f"{moment.astimezone(zone).strftime('%a %d %b %Y, %H:%M')} ({label})"


def credits_label(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    text = f"{number:g}"
    return f"{text} credit{'' if number == 1 else 's'}"


# type -> (required fields, subject, headline, lines(data), call to action label)
TEMPLATES = {
    "BOOKING_CREATED": (
        ("actor", "skill", "time"),
        lambda d: f"{d['actor']} wants to learn {d['skill']} with you",
        lambda d: "New session request",
        lambda d: [f"{d['actor']} requested a {d['skill']} video session on {d['when']}."]
        + ([f"Their note: “{d['note']}”"] if d.get("note") else [])
        + ["Accept the request to confirm the time; the credits are reserved from their balance when you do."],
        "Review request",
    ),
    "BOOKING_ACCEPTED": (
        ("actor", "skill", "time"),
        lambda d: f"{d['actor']} confirmed your {d['skill']} session",
        lambda d: "Your session is confirmed",
        lambda d: [f"{d['actor']} accepted your {d['skill']} session for {d['when']}.",
                   "The video room opens 10 minutes before the start. Just come back to SkillSwap and press Join."],
        "Open session",
    ),
    "BOOKING_DECLINED": (
        ("actor", "skill"),
        lambda d: f"{d['actor']} could not take your {d['skill']} request",
        lambda d: "Request declined",
        lambda d: [f"{d['actor']} declined your {d['skill']} request. You have not been charged.",
                   "Other members teach the same skill, so keep exploring."],
        "Find another teacher",
    ),
    "BOOKING_CANCELLED": (
        ("actor", "skill", "time"),
        lambda d: f"{d['actor']} cancelled your {d['skill']} session",
        lambda d: "Session cancelled",
        lambda d: [f"{d['actor']} cancelled the {d['skill']} session planned for {d['when']}.",
                   "Any credits reserved for it have been returned."],
        "View bookings",
    ),
    "BOOKING_COMPLETED": (
        ("actor", "skill"),
        lambda d: f"You earned credits for teaching {d['skill']}",
        lambda d: "Credits received",
        lambda d: [f"{d['actor']} confirmed your {d['skill']} session."]
        + ([f"{credits_label(d['credits'])} were added to your wallet."] if d.get("credits") not in (None, "") else
           ["Your credits have been transferred."]),
        "View wallet",
    ),
    "SESSION_REMINDER": (
        ("actor", "skill", "time"),
        lambda d: f"Starting soon: {d['skill']} with {d['actor']}",
        lambda d: "Your session starts soon",
        lambda d: [f"Your {d['skill']} session with {d['actor']} starts at {d['when']}.",
                   "Find a quiet spot, check your camera and microphone, and join from the link below."],
        "Join session",
    ),
    "CREDITS_PURCHASED": (
        ("credits", "amount"),
        lambda d: f"Receipt: {credits_label(d['credits'])} added to your wallet",
        lambda d: "Thanks for your purchase",
        lambda d: [f"We added {credits_label(d['credits'])} to your wallet. You paid {d['amount']}.",
                   "Credits never expire. Spend them on any session."],
        "Find a teacher",
    ),
    "SUBSCRIPTION_RECEIPT": (
        ("credits", "amount"),
        lambda d: "Receipt: SkillSwap Pro",
        lambda d: "Your Pro payment succeeded",
        lambda d: [f"Your SkillSwap Pro payment of {d['amount']} went through.",
                   f"{credits_label(d['credits'])} were added to your wallet."],
        "View wallet",
    ),
}


def safe_url(value):
    """Only plain web links may become buttons."""
    text = str(value or "")
    return text if text.startswith(("https://", "http://")) else ""


def render(event_type, data):
    """Returns (subject, plain text, html) for an event, or raises KeyError naming a missing field."""
    required, subject, headline, lines, cta = TEMPLATES[event_type]
    for field in required:
        if data.get(field) in (None, ""):
            raise KeyError(field)
    values = {key: str(value) if value is not None else "" for key, value in data.items()}
    if "time" in values:
        values["when"] = format_time(values["time"], values.get("timezone"))
    paragraphs = lines(values)
    url = safe_url(data.get("url"))

    text = "\n\n".join(paragraphs + ([f"{cta}: {url}"] if url else []) + [f"— The {BRAND} team"])
    body_html = "".join(f'<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#374151">{escape(p)}</p>' for p in paragraphs)
    button = (f'<p style="margin:24px 0 8px"><a href="{escape(url, quote=True)}" style="background:{ACCENT};color:#ffffff;'
              f'text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">{escape(cta)}</a></p>') if url else ""
    html = (
        '<!doctype html><html><body style="margin:0;background:#f5f6fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">'
        '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">'
        f'<tr><td style="padding:20px 32px;background:{ACCENT};color:#ffffff;font-weight:700;font-size:18px">{BRAND}</td></tr>'
        f'<tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-size:22px;color:#111827">{escape(headline(values))}</h1>{body_html}{button}</td></tr>'
        f'<tr><td style="padding:16px 32px 28px;font-size:12px;color:#9ca3af">You are receiving this because you have a {BRAND} account.</td></tr>'
        '</table></td></tr></table></body></html>'
    )
    return subject(values), text, html


@app.get("/")
def health():
    return jsonify({"status": "Notification service is running"})


@app.post("/notify")
def notify():
    if not authorized(request):
        return jsonify({"message": "Unauthorized"}), 401

    payload = request.get_json(silent=True) or {}
    event_type = payload.get("type")
    recipient = payload.get("recipientEmail")
    data = payload.get("data", {})

    if event_type not in TEMPLATES or not recipient or not isinstance(data, dict):
        return jsonify({"message": "type, recipientEmail and a data object are required"}), 400

    try:
        subject, text, html = render(event_type, data)
    except KeyError as error:
        app.logger.error("Missing template field: %s", error)
        return jsonify({"delivered": False, "message": f"Missing template field: {error.args[0]}"}), 400

    resend_api_key = os.getenv("RESEND_API_KEY")
    email_from = os.getenv("EMAIL_FROM", "onboarding@resend.dev")
    if not resend_api_key:
        app.logger.error("RESEND_API_KEY missing")
        return jsonify({"delivered": False, "message": "Email provider is not configured"}), 503

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {resend_api_key}", "Content-Type": "application/json"},
            json={"from": email_from, "to": [recipient], "subject": subject, "text": text, "html": html},
            timeout=10,
        )
        if response.status_code >= 400:
            app.logger.error("Resend rejected email: %s %s", response.status_code, response.text)
            return jsonify({"delivered": False, "message": "Email provider rejected the delivery"}), 502
        app.logger.info("Email delivered: %s", event_type)
        return jsonify({"delivered": True})
    except requests.RequestException:
        app.logger.exception("Resend request failed")
        return jsonify({"delivered": False, "message": "Email provider unavailable"}), 502


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "7000")))
