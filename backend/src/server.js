require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { z } = require("zod");
const db = require("./db");
const { sendBookingEmail, sendContactFormEmail, hasSmtpConfig } = require("./mailer");

const app = express();
const port = Number(process.env.PORT || 4000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const weekdayTimes = [
  "09:00",
  "10:00",
  "11:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
];
const saturdayTimes = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];
const allowedServices = [
  "Taille de barbe",
  "Coupe + barbe",
  "Rasage à l’ancienne",
  "Soin barbe premium",
];

function parseAllowedOrigins(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins(FRONTEND_ORIGIN);
const localhostOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const githubPagesOriginRegex = /^https:\/\/[\w-]+\.github\.io$/i;

app.use(
  cors({
    origin(origin, callback) {
      // Allow file:// (origin null) and local dev.
      if (!origin) return callback(null, true);
      if (githubPagesOriginRegex.test(origin)) return callback(null, true);
      if (!allowedOrigins.length) {
        // If not configured, allow localhost origins in dev.
        if (localhostOriginRegex.test(origin)) return callback(null, true);
        return callback(new Error("Origin not allowed by CORS"));
      }

      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (localhostOriginRegex.test(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    },
  })
);
app.use(express.json());

const bookingSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  service: z.enum(allowedServices),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

const contactSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  subject: z.string().min(3).max(120),
  message: z.string().min(10).max(3000),
});

function isSunday(dateIso) {
  const day = new Date(`${dateIso}T00:00:00`).getDay();
  return day === 0;
}

function getAllowedTimesForDate(dateIso) {
  const day = new Date(`${dateIso}T00:00:00`).getDay();
  if (day === 0) return [];
  if (day === 6) return saturdayTimes;
  return weekdayTimes;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/mailer-status", (_req, res) => {
  res.json({ configured: hasSmtpConfig() });
});

app.post("/api/admin/test-mail", requireAdminAuth, async (req, res) => {
  const to = String(req.body?.to || process.env.CONTACT_RECIPIENT || "").trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: "Adresse email de test invalide." });
  }

  try {
    const mailResult = await sendBookingEmail({
      type: "pending",
      booking: {
        bookingId: 0,
        fullName: "Test BookMyBeard",
        email: to,
        service: "Taille de barbe",
        date: "2026-05-22",
        time: "10:00",
      },
    });
    return res.json({
      ok: true,
      to,
      emailStatus: mailResult.status,
      message: "Email de test envoye.",
    });
  } catch (error) {
    console.error("[MAILER] Test email failed:", error);
    return res.status(500).json({
      ok: false,
      error: "Echec envoi email de test.",
      details: String(error.message || error),
    });
  }
});

app.get("/api/availability", (req, res) => {
  const date = String(req.query.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Date invalide. Format attendu: YYYY-MM-DD." });
  }

  if (isSunday(date)) {
    return res.json({ date, available: [] });
  }

  const allowedTimesForDate = getAllowedTimesForDate(date);

  const rows = db
    .prepare(
      `
      SELECT booking_time
      FROM bookings
      WHERE booking_date = ? AND status IN ('pending', 'confirmed')
    `
    )
    .all(date);

  const bookedSet = new Set(rows.map((r) => r.booking_time));
  const available = allowedTimesForDate.filter((t) => !bookedSet.has(t));
  return res.json({ date, available });
});

app.post("/api/bookings", async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Données invalides.",
      details: parsed.error.flatten(),
    });
  }

  const { fullName, email, service, date, time } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  if (isSunday(date)) {
    return res.status(400).json({
      error: "Le salon est fermé le dimanche. Merci de choisir un autre jour.",
    });
  }

  const allowedTimesForDate = getAllowedTimesForDate(date);
  if (!allowedTimesForDate.includes(time)) {
    return res.status(400).json({
      error: "Heure invalide pour ce jour. Lun-Ven 09:00-19:00, Samedi 09:00-17:00.",
    });
  }

  try {
    const existingBookingsCount = db
      .prepare("SELECT COUNT(*) AS count FROM bookings WHERE email = ?")
      .get(normalizedEmail).count;
    // Business rule is decided server-side only:
    // discount applies once, on the first reservation for this email.
    const firstVisitDiscountApplied = existingBookingsCount === 0 ? 1 : 0;

    const insert = db.prepare(
      `
      INSERT INTO bookings (
        full_name,
        email,
        service,
        booking_date,
        booking_time,
        status,
        first_visit_discount
      )
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `
    );

    const result = insert.run(
      fullName.trim(),
      normalizedEmail,
      service,
      date,
      time,
      firstVisitDiscountApplied
    );
    const bookingId = result.lastInsertRowid;

    // Respond immediately; email is sent in background to avoid long waits.
    void sendBookingEmail({
      type: "pending",
      booking: { bookingId, fullName, email, service, date, time },
    })
      .then(function (mailResult) {
        console.log(`[MAILER] Email reservation #${bookingId}: ${mailResult.status}`);
      })
      .catch(function (mailError) {
        console.error("[MAILER] Erreur envoi confirmation:", mailError);
      });

    return res.status(201).json({
      id: bookingId,
      status: "pending",
      message: "Demande de réservation enregistrée.",
      emailStatus: "sent",
      firstVisitDiscountApplied: Boolean(firstVisitDiscountApplied),
    });
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE constraint failed")) {
      return res.status(409).json({
        error: "Ce créneau est déjà réservé. Merci d’en choisir un autre.",
      });
    }

    console.error("[BOOKING] Erreur serveur:", error);
    return res.status(500).json({ error: "Erreur serveur." });
  }
});

app.post("/api/contact", async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Données de contact invalides.",
      details: parsed.error.flatten(),
    });
  }

  const payload = {
    fullName: parsed.data.fullName.trim(),
    email: parsed.data.email.trim().toLowerCase(),
    subject: parsed.data.subject.trim(),
    message: parsed.data.message.trim(),
  };

  try {
    const mailResult = await sendContactFormEmail(payload);
    return res.status(201).json({
      ok: true,
      emailStatus: mailResult.status,
      message: "Message de contact envoyé.",
    });
  } catch (error) {
    console.error("[CONTACT] Erreur envoi formulaire:", error);
    return res.status(500).json({
      error: "Impossible d'envoyer le message de contact.",
    });
  }
});

app.get("/api/bookings", (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        id,
        full_name AS fullName,
        email,
        service,
        booking_date AS date,
        booking_time AS time,
        status,
        first_visit_discount AS firstVisitDiscount,
        created_at AS createdAt
      FROM bookings
      ORDER BY booking_date DESC, booking_time DESC
    `
    )
    .all();
  res.json(rows);
});

function requireAdminAuth(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({
      error: "Mot de passe admin non configuré sur le serveur.",
    });
  }

  const provided = req.headers["x-admin-password"];
  if (!provided || String(provided) !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Accès administrateur refusé." });
  }

  next();
}

app.get("/api/admin/auth-check", requireAdminAuth, (_req, res) => {
  res.json({ ok: true });
});

app.patch("/api/admin/bookings/:id/status", requireAdminAuth, async (req, res) => {
  const id = Number(req.params.id);
  const statusSchema = z.object({
    status: z.enum(["confirmed", "cancelled"]),
    adminNote: z.string().max(500).optional(),
  });
  const parsed = statusSchema.safeParse(req.body || {});
  if (!id || !parsed.success) {
    return res.status(400).json({ error: "Requête invalide." });
  }

  const existing = db
    .prepare(
      `
      SELECT id, full_name AS fullName, email, service, booking_date AS date, booking_time AS time, status
      FROM bookings
      WHERE id = ?
    `
    )
    .get(id);
  if (!existing) {
    return res.status(404).json({ error: "Réservation introuvable." });
  }

  const { status, adminNote } = parsed.data;
  const noteValue = adminNote ? adminNote.trim() : null;

  try {
    if (status === "cancelled") {
      db.prepare(
        `
        UPDATE bookings
        SET status = 'cancelled', admin_note = ?, cancelled_at = datetime('now')
        WHERE id = ?
      `
      ).run(noteValue, id);
    } else {
      db.prepare(
        `
        UPDATE bookings
        SET status = 'confirmed', admin_note = ?, cancelled_at = NULL
        WHERE id = ?
      `
      ).run(noteValue, id);
    }
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE constraint failed")) {
      return res.status(409).json({
        error: "Ce créneau est déjà occupé par une réservation active.",
      });
    }
    console.error("[ADMIN] Erreur update status:", error);
    return res.status(500).json({ error: "Erreur serveur." });
  }

  let emailStatus = "failed";
  try {
    const mailResult = await sendBookingEmail({
      type: status === "confirmed" ? "confirmed" : "cancelled",
      booking: {
        bookingId: existing.id,
        fullName: existing.fullName,
        email: existing.email,
        service: existing.service,
        date: existing.date,
        time: existing.time,
      },
    });
    emailStatus = mailResult.status;
  } catch (mailError) {
    console.error("[MAILER] Erreur email admin action:", mailError);
  }

  return res.json({
    ok: true,
    id,
    status,
    emailStatus,
  });
});

app.delete("/api/admin/bookings/:id", requireAdminAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "ID invalide." });
  }

  const existing = db
    .prepare(
      `
      SELECT id, full_name AS fullName, email, service, booking_date AS date, booking_time AS time, status
      FROM bookings
      WHERE id = ?
    `
    )
    .get(id);
  if (!existing) {
    return res.status(404).json({ error: "Réservation introuvable." });
  }

  db.prepare("DELETE FROM bookings WHERE id = ?").run(id);

  let emailStatus = "failed";
  try {
    const mailResult = await sendBookingEmail({
      type: "cancelled",
      booking: {
        bookingId: existing.id,
        fullName: existing.fullName,
        email: existing.email,
        service: existing.service,
        date: existing.date,
        time: existing.time,
      },
    });
    emailStatus = mailResult.status;
  } catch (mailError) {
    console.error("[MAILER] Erreur email suppression:", mailError);
  }

  return res.json({
    ok: true,
    id,
    deleted: true,
    emailStatus,
  });
});

app.get("/api/admin/stats", requireAdminAuth, (_req, res) => {
  const total = db.prepare("SELECT COUNT(*) AS count FROM bookings").get().count;

  const byStatus = db
    .prepare(
      `
      SELECT status, COUNT(*) AS count
      FROM bookings
      GROUP BY status
    `
    )
    .all();

  const byService = db
    .prepare(
      `
      SELECT service, COUNT(*) AS count
      FROM bookings
      GROUP BY service
      ORDER BY count DESC
    `
    )
    .all();

  const byDay = db
    .prepare(
      `
      SELECT booking_date AS day, COUNT(*) AS count
      FROM bookings
      GROUP BY booking_date
      ORDER BY booking_date DESC
      LIMIT 30
    `
    )
    .all();

  const upcomingConfirmed = db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM bookings
      WHERE status = 'confirmed'
        AND booking_date >= date('now')
    `
    )
    .get().count;

  const cancellationRate = total
    ? Number(
        (
          ((byStatus.find((s) => s.status === "cancelled")?.count || 0) / total) *
          100
        ).toFixed(1)
      )
    : 0;

  res.json({
    total,
    upcomingConfirmed,
    cancellationRate,
    byStatus,
    byService,
    byDay,
  });
});

app.listen(port, () => {
  console.log(`BookMyBeard API running on http://localhost:${port}`);
});
