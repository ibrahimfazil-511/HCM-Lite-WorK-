function getEmailConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM_EMAIL,
  };
}

export async function sendEmployeeWelcomeEmail({ name, email, temporaryPassword, companyName }) {
  const { apiKey, from } = getEmailConfig();
  if (!apiKey || !from) {
    return { sent: false, reason: "Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL." };
  }

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `${companyName || "HCM Lite"} employee portal access`,
        text: [
          `Hello ${name},`,
          "",
          `Your employee account for ${companyName || "HCM Lite"} is ready.`,
          `Login email: ${email}`,
          `Temporary password: ${temporaryPassword}`,
          "",
          "Sign in and create a permanent password on your first login.",
        ].join("\n"),
      }),
    });
  } catch {
    return { sent: false, reason: "Email provider could not be reached." };
  }

  if (!response.ok) {
    const details = await response.text();
    return { sent: false, reason: `Email provider rejected the message (${response.status}).`, details };
  }
  const result = await response.json();
  return { sent: true, providerId: result.id };
}
