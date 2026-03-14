"""
Email Sending Service for Edge Brain AI
Sends beautiful, personalised HTML offer emails to users.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import os
import re
from dotenv import load_dotenv

load_dotenv()

SMTP_SERVER    = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT      = int(os.getenv("SMTP_PORT", "587"))
SENDER_EMAIL   = os.getenv("SENDER_EMAIL", "edgebrain@example.com")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "")
SENDER_NAME    = os.getenv("SENDER_NAME", "Edge Brain AI")


def _parse_offer(offer_text: str) -> dict:
    """Extract structured fields from the OFFER/DISCOUNT/URGENCY/MESSAGE/EMAIL_SUBJECT block."""
    fields = {
        "offer": "",
        "discount": "",
        "urgency": "",
        "message": "",
        "email_subject": "",
    }
    patterns = {
        "offer":         r"OFFER:\s*(.+?)(?=\n(?:DISCOUNT|URGENCY|MESSAGE|EMAIL_SUBJECT):|\Z)",
        "discount":      r"DISCOUNT:\s*(.+?)(?=\n(?:OFFER|URGENCY|MESSAGE|EMAIL_SUBJECT):|\Z)",
        "urgency":       r"URGENCY:\s*(.+?)(?=\n(?:OFFER|DISCOUNT|MESSAGE|EMAIL_SUBJECT):|\Z)",
        "message":       r"MESSAGE:\s*(.+?)(?=\n(?:OFFER|DISCOUNT|URGENCY|EMAIL_SUBJECT):|\Z)",
        "email_subject": r"EMAIL_SUBJECT:\s*(.+?)(?=\n(?:OFFER|DISCOUNT|URGENCY|MESSAGE):|\Z)",
    }
    for key, pat in patterns.items():
        m = re.search(pat, offer_text, re.DOTALL | re.IGNORECASE)
        if m:
            fields[key] = m.group(1).strip()
    return fields


def send_offer_email(
    recipient_email: str,
    recipient_name: str,
    store_name: str,
    offer_text: str,
    user_analysis: str = "",
    inventory_analysis: str = "",
) -> bool:
    """
    Send a beautifully designed personalised offer email.
    Returns True if sent (or simulated), False on error.
    """
    try:
        p = _parse_offer(offer_text)

        offer_line    = p["offer"]    or "Special personalised offer"
        discount_line = p["discount"] or "Exclusive savings"
        urgency_line  = p["urgency"]  or "Limited time only!"
        message_line  = p["message"]  or offer_text[:200]
        subject_line  = p["email_subject"] or f"🎁 Exclusive Offer at {store_name}!"

        # Split OFFER into primary + bundle parts if " + " present
        offer_parts = offer_line.split(" + ", 1)
        primary_item = offer_parts[0].strip()
        bundle_item  = offer_parts[1].strip() if len(offer_parts) > 1 else ""

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{subject_line}</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    padding: 24px 16px;
  }}
  .wrapper {{
    max-width: 600px;
    margin: 0 auto;
  }}
  /* Header */
  .header {{
    background: linear-gradient(135deg, #6366f1 0%, #ec4899 100%);
    border-radius: 16px 16px 0 0;
    padding: 32px 24px 24px;
    text-align: center;
  }}
  .header .logo {{
    font-size: 13px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.75);
    margin-bottom: 8px;
  }}
  .header h1 {{
    font-size: 28px;
    font-weight: 800;
    color: #fff;
    line-height: 1.2;
  }}
  .header .store-tag {{
    display: inline-block;
    margin-top: 12px;
    background: rgba(255,255,255,0.2);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    padding: 5px 14px;
    border-radius: 20px;
  }}
  /* Body card */
  .body {{
    background: #1e293b;
    padding: 28px 24px;
  }}
  .greeting {{
    font-size: 16px;
    color: #cbd5e1;
    line-height: 1.6;
    margin-bottom: 24px;
  }}
  .greeting strong {{ color: #f1f5f9; }}
  /* Offer box */
  .offer-box {{
    background: linear-gradient(135deg, #1e3a8a 0%, #4c1d95 100%);
    border: 1px solid #6366f1;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 20px;
    text-align: center;
  }}
  .offer-label {{
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #a5b4fc;
    margin-bottom: 10px;
  }}
  .offer-title {{
    font-size: 20px;
    font-weight: 700;
    color: #fff;
    line-height: 1.3;
  }}
  .offer-plus {{
    display: inline-block;
    margin: 8px 0;
    color: #a5b4fc;
    font-size: 18px;
  }}
  /* Discount badge */
  .discount-badge {{
    display: inline-block;
    margin-top: 14px;
    background: linear-gradient(90deg, #10b981, #059669);
    color: #fff;
    font-size: 18px;
    font-weight: 800;
    padding: 10px 24px;
    border-radius: 30px;
    letter-spacing: 0.5px;
  }}
  /* Urgency banner */
  .urgency-banner {{
    background: #7c2d12;
    border: 1px solid #f97316;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }}
  .urgency-icon {{ font-size: 20px; }}
  .urgency-text {{
    font-size: 14px;
    color: #fed7aa;
    font-weight: 600;
    line-height: 1.4;
  }}
  /* Message */
  .message-section {{
    background: #0f172a;
    border-left: 4px solid #6366f1;
    border-radius: 0 8px 8px 0;
    padding: 16px 20px;
    margin-bottom: 24px;
  }}
  .message-section p {{
    font-size: 15px;
    color: #cbd5e1;
    line-height: 1.7;
  }}
  /* Redemption box */
  .redeem-box {{
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
  }}
  .redeem-box h3 {{
    font-size: 14px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 12px;
  }}
  .redeem-step {{
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 10px;
  }}
  .step-num {{
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #6366f1;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }}
  .step-text {{
    font-size: 14px;
    color: #cbd5e1;
    line-height: 1.5;
    padding-top: 3px;
  }}
  /* AI badge */
  .ai-badge {{
    text-align: center;
    margin-bottom: 20px;
  }}
  .ai-badge span {{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 12px;
    color: #64748b;
  }}
  /* Footer */
  .footer {{
    background: #0f172a;
    border-radius: 0 0 16px 16px;
    padding: 20px 24px;
    text-align: center;
    border-top: 1px solid #1e293b;
  }}
  .footer p {{
    font-size: 12px;
    color: #475569;
    line-height: 1.6;
  }}
  .footer a {{ color: #6366f1; text-decoration: none; }}
</style>
</head>
<body>
<div class="wrapper">

  <!-- HEADER -->
  <div class="header">
    <div class="logo">⚡ Edge Brain AI</div>
    <h1>You've got a personalised deal! 🎁</h1>
    <div class="store-tag">📍 {store_name}</div>
  </div>

  <!-- BODY -->
  <div class="body">
    <p class="greeting">
      Hi <strong>{recipient_name}</strong>,<br /><br />
      Our AI spotted that you're near <strong>{store_name}</strong> and put together
      an offer based on your preferences and purchase history — just for you.
    </p>

    <!-- OFFER BOX -->
    <div class="offer-box">
      <div class="offer-label">✨ Your Personalised Bundle</div>
      {'<div class="offer-title">' + primary_item + '</div><div class="offer-plus">+</div><div class="offer-title">' + bundle_item + '</div>' if bundle_item else '<div class="offer-title">' + offer_line + '</div>'}
      <div class="discount-badge">🔥 {discount_line}</div>
    </div>

    <!-- URGENCY BANNER -->
    <div class="urgency-banner">
      <div class="urgency-icon">⏰</div>
      <div class="urgency-text">{urgency_line}</div>
    </div>

    <!-- MESSAGE -->
    <div class="message-section">
      <p>{message_line}</p>
    </div>

    <!-- HOW TO REDEEM -->
    <div class="redeem-box">
      <h3>🛍️ How to Redeem</h3>
      <div class="redeem-step">
        <div class="step-num">1</div>
        <div class="step-text">Visit <strong>{store_name}</strong> — you're already nearby!</div>
      </div>
      <div class="redeem-step">
        <div class="step-num">2</div>
        <div class="step-text">Pick up your <strong>{primary_item}</strong>{(' and ' + bundle_item) if bundle_item else ''}.</div>
      </div>
      <div class="redeem-step">
        <div class="step-num">3</div>
        <div class="step-text">Show this email at checkout to unlock your exclusive discount.</div>
      </div>
    </div>

    <!-- AI BADGE -->
    <div class="ai-badge">
      <span>🤖 Offer generated by 4-agent AI system • Personalised just for you</span>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <p>This offer was crafted by Edge Brain AI using your purchase history and preferences.<br />
    <strong>⏰ Valid today only.</strong> Terms and conditions may apply.<br /><br />
    © Edge Brain AI · <a href="#">Unsubscribe</a> · <a href="#">Privacy Policy</a></p>
  </div>

</div>
</body>
</html>"""

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject_line
        msg["From"]    = f"{SENDER_NAME} <{SENDER_EMAIL}>"
        msg["To"]      = recipient_email
        msg.attach(MIMEText(html_content, "html"))

        if SENDER_PASSWORD:
            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                server.starttls()
                server.login(SENDER_EMAIL, SENDER_PASSWORD)
                server.send_message(msg)
            print(f"✅ Offer email sent to {recipient_email}")
            return True
        else:
            # Simulate in dev / when not configured
            print(f"📧 [EMAIL SIMULATED] → {recipient_email}")
            print(f"   Subject : {subject_line}")
            print(f"   Offer   : {offer_line}")
            print(f"   Discount: {discount_line}")
            return True   # return True so the API still marks it as "sent"

    except Exception as e:
        print(f"❌ Error sending offer email: {e}")
        return False


def send_welcome_email(recipient_email: str, recipient_name: str) -> bool:
    """Send a welcome email when a user registers."""
    try:
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px 16px; }}
  .wrapper {{ max-width: 560px; margin: 0 auto; }}
  .header {{ background: linear-gradient(135deg, #6366f1, #ec4899); border-radius: 16px 16px 0 0; padding: 32px 24px; text-align: center; }}
  .header h1 {{ font-size: 26px; font-weight: 800; color: #fff; }}
  .body {{ background: #1e293b; padding: 28px 24px; border-radius: 0 0 16px 16px; }}
  .body p {{ font-size: 15px; color: #cbd5e1; line-height: 1.7; margin-bottom: 16px; }}
  .feature {{ display: flex; gap: 12px; margin-bottom: 14px; }}
  .feature-icon {{ font-size: 22px; flex-shrink: 0; }}
  .feature-text {{ font-size: 14px; color: #94a3b8; }}
  .feature-text strong {{ color: #e2e8f0; }}
  .footer {{ text-align: center; margin-top: 16px; font-size: 12px; color: #475569; }}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:8px;">⚡ Edge Brain AI</div>
    <h1>Welcome, {recipient_name}! 🎉</h1>
  </div>
  <div class="body">
    <p>Thanks for joining <strong>Edge Brain AI</strong> — your personal shopping intelligence.</p>
    <p>Here's how it works:</p>
    <div class="feature">
      <div class="feature-icon">📍</div>
      <div class="feature-text"><strong>Geofence Detection</strong><br />When you're near a partner store, our system activates automatically.</div>
    </div>
    <div class="feature">
      <div class="feature-icon">🤖</div>
      <div class="feature-text"><strong>4-Agent AI System</strong><br />Analyses your preferences, purchase history, and live inventory in seconds.</div>
    </div>
    <div class="feature">
      <div class="feature-icon">🎁</div>
      <div class="feature-text"><strong>Personalised Deals</strong><br />Receive offers crafted just for you — right when you need them.</div>
    </div>
    <div class="feature">
      <div class="feature-icon">📧</div>
      <div class="feature-text"><strong>Email Notifications</strong><br />Get deals delivered to your inbox so you never miss an offer.</div>
    </div>
    <p style="text-align:center;margin-top:24px;font-size:16px;">Happy shopping! 🛍️</p>
  </div>
  <div class="footer">© Edge Brain AI · Powered by multi-agent intelligence</div>
</div>
</body>
</html>"""

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "🎉 Welcome to Edge Brain AI!"
        msg["From"]    = f"{SENDER_NAME} <{SENDER_EMAIL}>"
        msg["To"]      = recipient_email
        msg.attach(MIMEText(html_content, "html"))

        if SENDER_PASSWORD:
            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                server.starttls()
                server.login(SENDER_EMAIL, SENDER_PASSWORD)
                server.send_message(msg)
            return True
        else:
            print(f"📧 [WELCOME EMAIL SIMULATED] → {recipient_email}")
            return True

    except Exception as e:
        print(f"❌ Error sending welcome email: {e}")
        return False
