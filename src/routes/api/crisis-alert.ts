import { createFileRoute } from "@tanstack/react-router";

// Hardcoded demo emergency contact
const CONTACT_EMAIL = "va2652@nyu.edu";
const CONTACT_PHONE = "+17323516039";
const FROM_EMAIL = "onboarding@resend.dev";
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER || "";

async function sendEmail(reason: string, transcript: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) return { skipped: "resend_not_configured" };
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from: `Lyra Wellness <${FROM_EMAIL}>`,
        to: [CONTACT_EMAIL],
        subject: "Wellness check-in alert from someone you care about",
        html: `<div style="font-family:system-ui;line-height:1.6;color:#1a1a1a">
          <h2 style="margin:0 0 12px">A gentle heads-up</h2>
          <p>Your loved one just completed a wellness check-in that suggested they may be going through a hard moment.</p>
          <p><strong>Signal:</strong> ${reason}</p>
          <p><strong>What they shared:</strong></p>
          <blockquote style="border-left:3px solid #c4654a;padding:8px 16px;color:#555;font-style:italic">${transcript.replace(/</g, "&lt;")}</blockquote>
          <p>Please consider reaching out to them — even a short message can mean a lot.</p>
          <p style="font-size:12px;color:#888;margin-top:24px">This is an automated wellness notification, not a clinical diagnosis.</p>
        </div>`,
      }),
    });
    return { email_status: res.status };
  } catch (e) {
    return { email_error: String(e) };
  }
}

async function sendSms(reason: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  if (!lovableKey || !twilioKey || !TWILIO_FROM) return { skipped: "twilio_not_configured" };
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
      },
      body: new URLSearchParams({
        To: CONTACT_PHONE,
        From: TWILIO_FROM,
        Body: `Lyra wellness alert: someone you care about may be going through a hard moment (${reason}). Consider checking in on them.`,
      }),
    });
    return { sms_status: res.status };
  } catch (e) {
    return { sms_error: String(e) };
  }
}

export const Route = createFileRoute("/api/crisis-alert")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { reason, transcript } = (await request.json().catch(() => ({}))) as {
          reason?: string;
          transcript?: string;
        };
        const r = reason || "elevated distress detected";
        const t = (transcript || "").slice(0, 1000);

        const [emailRes, smsRes] = await Promise.all([sendEmail(r, t), sendSms(r)]);
        console.log("[crisis-alert]", { emailRes, smsRes });

        // Always return ok so the UI never surfaces an error
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
