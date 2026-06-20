import frappe
import requests
import base64
from frappe.model.document import Document
from frappe.utils import get_datetime, now

# =========================================================
# CONFIGURATION PLACEHOLDERS
# =========================================================
ZOOM_CLIENT_ID = ""
ZOOM_CLIENT_SECRET = ""
ZOOM_ACCOUNT_ID = ""
TELEGRAM_BOT_TOKEN = ""

ZOOM_TOKEN_URL = "https://zoom.us/oauth/token"
ZOOM_API_URL = "https://api.zoom.us/v2"

TIMEZONE = frappe.db.get_single_value("System Settings", "time_zone") or "Asia/Kolkata"

class ZoomMeeting(Document):
    pass

# =========================================================
# OAUTH TOKEN RETRIEVAL
# =========================================================
def get_zoom_token():
    if not ZOOM_CLIENT_ID or not ZOOM_CLIENT_SECRET or not ZOOM_ACCOUNT_ID:
        frappe.throw("Missing Zoom App Credentials in zoom_meeting.py configurations!")
        
    auth = base64.b64encode(f"{ZOOM_CLIENT_ID}:{ZOOM_CLIENT_SECRET}".encode()).decode()
    headers = {
        "Authorization": f"Basic {auth}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    payload = {
        "grant_type": "account_credentials",
        "account_id": ZOOM_ACCOUNT_ID
    }

    r = requests.post(ZOOM_TOKEN_URL, headers=headers, data=payload)
    if r.status_code != 200:
        frappe.throw(f"Zoom Token Error:<br>{r.text}")

    return r.json().get("access_token")

def get_zoom_headers():
    token = get_zoom_token()
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

def format_zoom_time(dt):
    if not dt:
        return None
    return get_datetime(dt).strftime("%Y-%m-%dT%H:%M:%S")

def build_invitation(doc, data):
    return f"""
📢 Rythu Sadhikara Samstha is inviting you to a scheduled Zoom meeting.

📌 Topic: {doc.subject}
🕒 Time: {doc.meeting_time}
🎥 Type: {doc.meeting_type}

🔗 Join Zoom Meeting
{data.get("join_url")}

🆔 Meeting ID: {data.get("id")}
🔐 Passcode: {data.get("password", "")}
    """.strip()

# =========================================================
# TELEGRAM DISPATCHERS
# =========================================================
def send_telegram(chat_id, message):
    if not chat_id or not TELEGRAM_BOT_TOKEN:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            data={"chat_id": chat_id, "text": message}
        )
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Telegram Error")

def notify_employees(doc, message):
    if not doc.get("employees"):
        return
    for row in doc.employees:
        chat_id = frappe.db.get_value("Employee", row.employee, "custom_telegram_chat_id")
        send_telegram(chat_id, message)

# =========================================================
# CORE WHITELISTED API ENDPOINTS
# =========================================================
@frappe.whitelist()
def create_zoom_meeting(docname): # Parameter name matched to JS
    doc = frappe.get_doc("Zoom Meeting", docname) # Fixed capitalization mismatch

    if doc.zoom_meeting_id:
        frappe.throw("Zoom meeting already created")

    payload = {
        "topic": doc.subject or "Zoom Meeting",
        "type": 2,
        "start_time": format_zoom_time(doc.meeting_time),
        "timezone": TIMEZONE,
        "duration": doc.duration or 30,
        "settings": {
            "join_before_host": True,
            "participant_video": True,
            "mute_upon_entry": True,
            "waiting_room": True
        }
    }

    r = requests.post(f"{ZOOM_API_URL}/users/me/meetings", headers=get_zoom_headers(), json=payload)
    if r.status_code not in [200, 201]:
        frappe.throw(f"Zoom API Error:<br>{r.text}")

    data = r.json()
    invitation = build_invitation(doc, data)

    # Database updates
    doc.db_set({
        "zoom_meeting_id": data.get("id"),
        "join_url": data.get("join_url"),
        "start_url": data.get("start_url"),
        "zoom_status": "Created",
        "invitation_text": invitation
    })

    for row in doc.employees:
        row.db_set("invitation_sent", 0)

    notify_employees(doc, invitation)
    return data

@frappe.whitelist()
def update_zoom_meeting(docname): # Parameter name matched to JS
    doc = frappe.get_doc("Zoom Meeting", docname) # Fixed capitalization mismatch

    if not doc.zoom_meeting_id:
        frappe.throw("No Zoom meeting found")

    payload = {
        "topic": doc.subject or "Zoom Meeting",
        "start_time": format_zoom_time(doc.meeting_time),
        "timezone": TIMEZONE,
        "duration": doc.duration or 30,
        "settings": {
            "join_before_host": True,
            "participant_video": True,
            "mute_upon_entry": True,
            "waiting_room": True
        }
    }

    r = requests.patch(f"{ZOOM_API_URL}/meetings/{doc.zoom_meeting_id}", headers=get_zoom_headers(), json=payload)
    if r.status_code not in [200, 204]:
        frappe.throw(f"Zoom Update Failed:<br>{r.text}")

    data = {
        "id": doc.zoom_meeting_id,
        "join_url": doc.join_url,
        "start_url": doc.start_url,
        "password": ""
    }

    invitation = build_invitation(doc, data)
    doc.db_set({
        "invitation_text": invitation,
        "zoom_status": "Created"
    })

    for row in doc.employees:
        row.db_set("invitation_sent", 0)

    notify_employees(doc, invitation)
    return "Meeting updated successfully"

@frappe.whitelist()
def delete_zoom_meeting(docname): # Parameter name matched to JS
    doc = frappe.get_doc("Zoom Meeting", docname) # Fixed capitalization mismatch

    if not doc.zoom_meeting_id:
        frappe.throw("No Zoom meeting found")

    r = requests.delete(f"{ZOOM_API_URL}/meetings/{doc.zoom_meeting_id}", headers=get_zoom_headers())
    if r.status_code not in [200, 204]:
        frappe.throw(f"Zoom Delete Failed:<br>{r.text}")

    doc.db_set({
        "zoom_status": "Deleted",
        "deleted_on": now(),
        "deleted_by": frappe.session.user
    })

    notify_employees(doc, f"🗑️ Zoom Meeting Deleted\n\n📌 Topic: {doc.subject}\n🕒 Time: {doc.meeting_time}\n\n⚠️ This meeting is no longer valid.")
    return "Meeting deleted successfully"

@frappe.whitelist()
def cancel_zoom_meeting(docname): # Parameter name matched to JS
    doc = frappe.get_doc("Zoom Meeting", docname) # Fixed capitalization mismatch
    doc.db_set("zoom_status", "Cancelled")

    notify_employees(doc, f"⚠️ Zoom Meeting Cancelled\n\n📌 Topic: {doc.subject}\n🕒 Time: {doc.meeting_time}")
    return "Meeting cancelled successfully"

@frappe.whitelist()
def send_new_participant_invitations(docname): # Parameter name matched to JS
    doc = frappe.get_doc("Zoom Meeting", docname) # Fixed capitalization mismatch

    if not doc.join_url:
        frappe.throw("Zoom meeting not created")

    invited = 0
    for row in doc.employees:
        if row.invitation_sent:
            continue

        chat_id = frappe.db.get_value("Employee", row.employee, "custom_telegram_chat_id")
        if not chat_id:
            continue

        message = f"📢 Zoom Meeting Invitation\n\n📌 Topic: {doc.subject}\n🕒 Time: {doc.meeting_time}\n🎥 Type: {doc.meeting_type}\n\n🔗 Join Link:\n{doc.join_url}\n\n🆔 Meeting ID:\n{doc.zoom_meeting_id}\n\n⚡ Please join on time."
        send_telegram(chat_id, message)
        row.db_set("invitation_sent", 1)
        invited += 1

    return f"{invited} invitations sent"
