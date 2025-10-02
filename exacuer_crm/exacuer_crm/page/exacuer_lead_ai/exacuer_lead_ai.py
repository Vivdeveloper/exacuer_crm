import frappe
import requests
import json
import base64
import os


# ----------------- SETTINGS FETCHER -----------------
def get_ai_settings():
    """Fetch AI settings from Exacuer Lead AI Settings (single doctype)."""
    settings = frappe.get_single("Exacuer Lead AI Settings")
    return {
        "api_key": settings.openrouter_api_key,
        "default_model": settings.default_model or "openai/gpt-4.1-mini",
        "enabled": bool(settings.enable_ai_parsing)
    }


# ----------------- AI PARSING -----------------
@frappe.whitelist()
def analyze_text(text, model: str = None):
    """
    Accept raw OCR text and extract structured lead info using OpenRouter.
    Returns parsed JSON (first_name, last_name, etc.)
    """

    settings = get_ai_settings()
    api_key = settings["api_key"]

    if not settings["enabled"]:
        return {"error": "AI Parsing is disabled in settings."}

    if not api_key:
        return {"error": "Missing OpenRouter API Key. Please set it in Exacuer Lead AI Settings."}

    model = model or settings["default_model"]

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": frappe.utils.get_url(),
        "X-Title": "Exacuer Lead AI"
    }

    system_prompt = """
    You are an AI parser for OCR text extracted from business cards.
    Task:
    - Clean and normalize messy OCR text.
    - Extract and map details into this JSON schema:

    {
      "first_name": "",
      "last_name": "",
      "source": "",
      "email_id": "",
      "mobile_no": "",
      "phone": "",
      "website": "",
      "whatsapp_no": "",
      "company_name": "",
      "city": "",
      "raw_text": ""
    }

    Rules:
    - Always return valid JSON only (no explanations, no extra text).
    - If a field is missing, return it as an empty string.
    - "raw_text" must contain the cleaned OCR text.
    """

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ],
        "temperature": 0
    }

    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            data=json.dumps(payload),
            timeout=60
        )
        response.raise_for_status()
        result = response.json()
        content = result["choices"][0]["message"]["content"]

        try:
            return json.loads(content)
        except Exception:
            # ⚠️ If AI returned junk, show clear error message
            return {"error": "AI returned invalid response", "raw_text": content}

    except Exception as e:
        # ⚠️ If AI service call fails, return structured error
        return {"error": f"AI service failed: {str(e)}"}


# ----------------- CREATE LEAD -----------------
@frappe.whitelist()
def create_lead(lead_data: dict | str, front_image: str = None, back_image: str = None):
    """
    Insert parsed lead into ERPNext Lead doctype.
    Optionally attach front/back visiting card images.
    
    lead_data: dict or JSON string with lead fields
    front_image/back_image: base64 data:image/... or /files/... URL
    """

    # Ensure dict
    if isinstance(lead_data, str):
        try:
            lead_data = json.loads(lead_data)
        except Exception:
            frappe.throw("Invalid JSON for lead_data")

    # Validate source (must exist in Lead Source)
    source = lead_data.get("source") or ""
    if source and not frappe.db.exists("Lead Source", source):
        frappe.get_doc({"doctype": "Lead Source", "name": source}).insert(ignore_permissions=True)

    # Map to Lead fields
    lead_fields = {
        "doctype": "Lead",
        "first_name": lead_data.get("first_name") or "",
        "last_name": lead_data.get("last_name") or "",
        "source": source,
        "email_id": lead_data.get("email_id") or "",
        "mobile_no": lead_data.get("mobile_no") or "",
        "phone": lead_data.get("phone") or "",
        "website": lead_data.get("website") or "",
        "whatsapp_no": lead_data.get("whatsapp_no") or "",
        "company_name": lead_data.get("company_name") or "",
        "city": lead_data.get("city") or "",
    }

    # Insert Lead
    doc = frappe.get_doc(lead_fields)
    doc.insert(ignore_permissions=True)

    # Attach images if provided
    for side, image_data in [("front", front_image), ("back", back_image)]:
        if image_data:
            file_url = _save_image(image_data, f"{doc.name}_{side}")
            if file_url:
                _attach_file_to_lead(doc.name, file_url)

    frappe.db.commit()
    return doc.name


# ----------------- HELPERS -----------------
def _save_image(image_data: str, file_base: str) -> str | None:
    """Save image (base64 or /files/ URL) and return file_url."""
    # Case 1: Already a file URL
    if image_data.startswith("/files/"):
        return image_data

    # Case 2: Base64 (data:image/png;base64,...)
    if image_data.startswith("data:image"):
        try:
            header, encoded = image_data.split(",", 1)
            file_ext = "png" if "png" in header else "jpg"
            file_name = f"{file_base}.{file_ext}"

            file_path = frappe.utils.get_site_path("public", "files", file_name)
            with open(file_path, "wb") as f:
                f.write(base64.b64decode(encoded))

            return f"/files/{file_name}"
        except Exception as e:
            frappe.log_error(f"Failed to save image {file_base}: {str(e)}")
            return None

    return None


def _attach_file_to_lead(lead_name: str, file_url: str):
    """Attach a file to the Lead doctype."""
    file_doc = frappe.get_doc({
        "doctype": "File",
        "file_url": file_url,
        "attached_to_doctype": "Lead",
        "attached_to_name": lead_name,
        "is_private": 0,
        "file_name": os.path.basename(file_url)
    })
    file_doc.insert(ignore_permissions=True)
