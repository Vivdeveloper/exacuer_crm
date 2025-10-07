import frappe
import requests
import json

def get_api_key():
    """Get OpenRouter API Key from settings"""
    return frappe.get_single("Exacuer Lead AI Settings").openrouter_api_key

@frappe.whitelist()
def get_ai_reply(message):
    api_key = get_api_key()
    if not api_key:
        return "⚠️ Missing OpenRouter API Key in settings."

    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Referer": frappe.utils.get_url(),
                "X-Title": "Exacuer CRM"
            },
            json={
                "model": "x-ai/grok-4-fast:free",
                "messages": [{"role": "user", "content": message}]
            },
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()
            return data["choices"][0]["message"]["content"]
        else:
            return f"⚠️ Error {response.status_code}: {response.text}"

    except Exception as e:
        return f"⚠️ Exception: {str(e)}"
