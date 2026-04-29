const nodemailer = require("nodemailer");

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM = "BookMyBeard <no-reply@bookmybeard.ch>",
  CONTACT_RECIPIENT = "matis.monnin@gmail.com",
} = process.env;

function hasSmtpConfig() {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
}

let transporter = null;
if (hasSmtpConfig()) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

function formatDateFr(dateIso) {
  const date = new Date(`${dateIso}T00:00:00`);
  return new Intl.DateTimeFormat("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildBookingReference(bookingId) {
  return `BMB-${String(bookingId).padStart(5, "0")}`;
}

function buildBookingEmailTemplate({ type, booking }) {
  const { bookingId, fullName, service, date, time } = booking;
  const bookingReference = buildBookingReference(bookingId);
  const prettyDate = formatDateFr(date);
  const safeName = escapeHtml(fullName);
  const safeService = escapeHtml(service);
  const safeDate = escapeHtml(prettyDate);
  const safeTime = escapeHtml(time);

  if (type === "pending") {
    return {
      subject: `Demande reçue ${bookingReference} - ${prettyDate} ${time} | BookMyBeard`,
      text: [
        `Bonjour ${fullName},`,
        "",
        "Votre demande de réservation a bien été enregistrée.",
        "Elle est en attente de confirmation par l'équipe BookMyBeard.",
        `Référence : ${bookingReference}`,
        `Service : ${service}`,
        `Date : ${prettyDate}`,
        `Heure : ${time}`,
        "",
        "Merci et à bientôt,",
        "BookMyBeard",
      ].join("\n"),
      html: `
      <div style="font-family: Inter, Arial, sans-serif; background:#f5f5f5; padding:24px; color:#1e1e1e;">
        <table role="presentation" style="width:100%; max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #e6e6e6; border-radius:12px; border-collapse:separate;">
          <tr>
            <td style="background:#1f3d3b; color:#ffffff; padding:16px 20px; border-top-left-radius:12px; border-top-right-radius:12px;">
              <div style="font-size:20px; font-weight:700;">BookMyBeard</div>
              <div style="font-size:13px; opacity:0.9;">Demande de réservation reçue</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;">
              <p style="margin:0 0 12px 0;">Bonjour ${safeName},</p>
              <p style="margin:0 0 14px 0;">Votre demande de réservation est enregistrée et en attente de confirmation.</p>
              <table role="presentation" style="width:100%; border-collapse:collapse; background:#fafafa; border:1px solid #ececec; border-radius:10px;">
                <tr><td style="padding:10px 12px; border-bottom:1px solid #ececec;"><strong>Référence</strong> : ${escapeHtml(bookingReference)}</td></tr>
                <tr><td style="padding:10px 12px; border-bottom:1px solid #ececec;"><strong>Service</strong> : ${safeService}</td></tr>
                <tr><td style="padding:10px 12px; border-bottom:1px solid #ececec;"><strong>Date</strong> : ${safeDate}</td></tr>
                <tr><td style="padding:10px 12px;"><strong>Heure</strong> : ${safeTime}</td></tr>
              </table>
              <p style="margin:16px 0 0 0; color:#6b6b6b;">Merci et à bientôt,<br/>BookMyBeard</p>
            </td>
          </tr>
        </table>
      </div>`,
    };
  }

  if (type === "confirmed") {
    return {
      subject: `Confirmation ${bookingReference} - ${prettyDate} ${time} | BookMyBeard`,
      text: [
        `Bonjour ${fullName},`,
        "",
        "Votre réservation est confirmée.",
        `Référence : ${bookingReference}`,
        `Service : ${service}`,
        `Date : ${prettyDate}`,
        `Heure : ${time}`,
        "",
        "Merci et à bientôt,",
        "BookMyBeard",
      ].join("\n"),
      html: `
      <div style="font-family: Inter, Arial, sans-serif; background:#f5f5f5; padding:24px; color:#1e1e1e;">
        <table role="presentation" style="width:100%; max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #e6e6e6; border-radius:12px; border-collapse:separate;">
          <tr>
            <td style="background:#1f3d3b; color:#ffffff; padding:16px 20px; border-top-left-radius:12px; border-top-right-radius:12px;">
              <div style="font-size:20px; font-weight:700;">BookMyBeard</div>
              <div style="font-size:13px; opacity:0.9;">Réservation confirmée</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;">
              <p style="margin:0 0 12px 0;">Bonjour ${safeName},</p>
              <p style="margin:0 0 14px 0;">Votre réservation est bien confirmée.</p>
              <table role="presentation" style="width:100%; border-collapse:collapse; background:#fafafa; border:1px solid #ececec; border-radius:10px;">
                <tr><td style="padding:10px 12px; border-bottom:1px solid #ececec;"><strong>Référence</strong> : ${escapeHtml(bookingReference)}</td></tr>
                <tr><td style="padding:10px 12px; border-bottom:1px solid #ececec;"><strong>Service</strong> : ${safeService}</td></tr>
                <tr><td style="padding:10px 12px; border-bottom:1px solid #ececec;"><strong>Date</strong> : ${safeDate}</td></tr>
                <tr><td style="padding:10px 12px;"><strong>Heure</strong> : ${safeTime}</td></tr>
              </table>
              <p style="margin:16px 0 0 0; color:#6b6b6b;">Merci et à bientôt,<br/>BookMyBeard</p>
            </td>
          </tr>
        </table>
      </div>`,
    };
  }

  return {
    subject: `Annulation ${bookingReference} - ${prettyDate} ${time} | BookMyBeard`,
    text: [
      `Bonjour ${fullName},`,
      "",
      "Votre réservation a été annulée.",
      `Référence : ${bookingReference}`,
      `Service : ${service}`,
      `Date : ${prettyDate}`,
      `Heure : ${time}`,
      "",
      "Vous pouvez réserver un nouveau créneau à tout moment.",
      "BookMyBeard",
    ].join("\n"),
    html: `
      <div style="font-family: Inter, Arial, sans-serif; background:#f5f5f5; padding:24px; color:#1e1e1e;">
        <table role="presentation" style="width:100%; max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #e6e6e6; border-radius:12px; border-collapse:separate;">
          <tr>
            <td style="background:#1e1e1e; color:#ffffff; padding:16px 20px; border-top-left-radius:12px; border-top-right-radius:12px;">
              <div style="font-size:20px; font-weight:700;">BookMyBeard</div>
              <div style="font-size:13px; opacity:0.9;">Réservation annulée</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;">
              <p style="margin:0 0 12px 0;">Bonjour ${safeName},</p>
              <p style="margin:0 0 14px 0;">Votre réservation a été annulée.</p>
              <table role="presentation" style="width:100%; border-collapse:collapse; background:#fafafa; border:1px solid #ececec; border-radius:10px;">
                <tr><td style="padding:10px 12px; border-bottom:1px solid #ececec;"><strong>Référence</strong> : ${escapeHtml(bookingReference)}</td></tr>
                <tr><td style="padding:10px 12px; border-bottom:1px solid #ececec;"><strong>Service</strong> : ${safeService}</td></tr>
                <tr><td style="padding:10px 12px; border-bottom:1px solid #ececec;"><strong>Date</strong> : ${safeDate}</td></tr>
                <tr><td style="padding:10px 12px;"><strong>Heure</strong> : ${safeTime}</td></tr>
              </table>
              <p style="margin:16px 0 0 0; color:#6b6b6b;">Vous pouvez réserver un nouveau créneau à tout moment.<br/>BookMyBeard</p>
            </td>
          </tr>
        </table>
      </div>`,
  };
}

async function sendBookingEmail({ type, booking }) {
  const { email } = booking;
  const { subject, text, html } = buildBookingEmailTemplate({ type, booking });

  if (!transporter) {
    console.log("[MAILER] SMTP non configuré. Email simulé:");
    console.log({ to: email, subject, text });
    return { status: "simulated" };
  }

  await transporter.sendMail({
    from: MAIL_FROM,
    to: email,
    subject,
    text,
    html,
  });

  return { status: "sent" };
}

async function sendBookingConfirmation({ bookingId, fullName, email, service, date, time }) {
  return sendBookingEmail({
    type: "confirmed",
    booking: { bookingId, fullName, email, service, date, time },
  });
}

async function sendContactFormEmail({ fullName, email, subject, message }) {
  const cleanName = fullName.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanSubject = subject.trim();
  const cleanMessage = message.trim();

  const finalSubject = `[Contact BookMyBeard] ${cleanSubject}`;
  const text = [
    "Nouveau message depuis le formulaire de contact.",
    "",
    `Nom: ${cleanName}`,
    `Email: ${cleanEmail}`,
    `Sujet: ${cleanSubject}`,
    "",
    "Message:",
    cleanMessage,
  ].join("\n");

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; background:#f5f5f5; padding:24px; color:#1e1e1e;">
      <table role="presentation" style="width:100%; max-width:620px; margin:0 auto; background:#ffffff; border:1px solid #e6e6e6; border-radius:12px; border-collapse:separate;">
        <tr>
          <td style="background:#1f3d3b; color:#ffffff; padding:16px 20px; border-top-left-radius:12px; border-top-right-radius:12px;">
            <div style="font-size:20px; font-weight:700;">BookMyBeard</div>
            <div style="font-size:13px; opacity:0.9;">Nouveau message de contact</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px;">
            <p style="margin:0 0 10px 0;"><strong>Nom</strong> : ${escapeHtml(cleanName)}</p>
            <p style="margin:0 0 10px 0;"><strong>Email</strong> : ${escapeHtml(cleanEmail)}</p>
            <p style="margin:0 0 14px 0;"><strong>Sujet</strong> : ${escapeHtml(cleanSubject)}</p>
            <p style="margin:0 0 6px 0;"><strong>Message</strong></p>
            <div style="background:#fafafa; border:1px solid #ececec; border-radius:10px; padding:12px; white-space:pre-wrap;">${escapeHtml(
              cleanMessage
            )}</div>
          </td>
        </tr>
      </table>
    </div>
  `;

  if (!transporter) {
    console.log("[MAILER] SMTP non configuré. Contact email simulé:");
    console.log({ to: CONTACT_RECIPIENT, replyTo: cleanEmail, subject: finalSubject, text });
    return { status: "simulated" };
  }

  await transporter.sendMail({
    from: MAIL_FROM,
    to: CONTACT_RECIPIENT,
    replyTo: cleanEmail,
    subject: finalSubject,
    text,
    html,
  });

  return { status: "sent" };
}

module.exports = {
  hasSmtpConfig,
  sendContactFormEmail,
  sendBookingEmail,
  sendBookingConfirmation,
};
