# BookMyBeard Backend

## Lancer en local

```bash
npm install
npm run dev
```

API par defaut: `http://localhost:4000`

## Variables d'environnement

Copie `.env.example` vers `.env` puis adapte si besoin.

## Endpoints

- `GET /api/health`
- `GET /api/mailer-status`
- `GET /api/availability?date=YYYY-MM-DD`
- `POST /api/bookings`
- `POST /api/contact`
- `GET /api/bookings`
- `GET /api/admin/auth-check`
- `GET /api/admin/stats`
- `PATCH /api/admin/bookings/:id/status` (confirmed/cancelled)
- `DELETE /api/admin/bookings/:id`

Les routes `/api/admin/*` sont protégées par `ADMIN_PASSWORD` via l'en-tête `x-admin-password`.

## Activer le vrai email (SMTP)

1. Copier le fichier d'environnement:

```bash
copy .env.example .env
```

2. Configurer `.env` avec un provider SMTP (recommande: Brevo):

```env
PORT=4000
FRONTEND_ORIGIN=http://localhost:5500
DB_PATH=./data/bookings.db

SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=votre_login_smtp
SMTP_PASS=votre_mot_de_passe_smtp
MAIL_FROM="BookMyBeard <no-reply@votredomaine.ch>"
CONTACT_RECIPIENT=matis.monnin@gmail.com
ADMIN_PASSWORD=votre_mot_de_passe_admin
```

3. Redemarrer l'API:

```bash
npm run dev
```

4. Verifier le statut du mailer:

```bash
curl http://localhost:4000/api/mailer-status
```

Si `configured: true`, les emails de confirmation sont envoyes en reel.

## Exemple de creation de reservation

```bash
curl -X POST http://localhost:4000/api/bookings ^
  -H "Content-Type: application/json" ^
  -d "{\"fullName\":\"Matis Dupont\",\"email\":\"matis@test.ch\",\"service\":\"Taille de barbe\",\"date\":\"2026-03-20\",\"time\":\"10:00\"}"
```

Le systeme bloque automatiquement un deuxieme booking sur le meme `date + time`.
