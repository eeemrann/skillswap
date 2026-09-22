# SkillSwap

SkillSwap is a peer-to-peer skill exchange platform. Members discover people who can teach what they want to learn, request sessions, exchange time credits, message booking partners, and leave reviews.

## Architecture

```text
React/Vite client -- Clerk session --> Express API -- MongoDB replica set
                                      |            \-- Python matching service
                                      \-- email queue --> Flask notification service --> Resend
```

| Directory | Purpose | Default port |
|---|---|---:|
| `client` | React 19/Vite single-page application | `5173` |
| `server` | Express REST API and email queue worker | `5000` |
| `matching-service` | Flask recommendation service | `6000` |
| `notification-service` | Authenticated Flask email delivery service | `7000` |

MongoDB must run as a replica set because completing a booking uses a multi-document transaction.

## Features

- Clerk email OTP and OAuth authentication.
- React Router-aware Clerk navigation for multi-step sign-in and sign-up.
- First-time onboarding for skills wanted and skills offered.
- Five starting time credits for new profiles.
- Skill, location, and availability-based matching.
- Booking requests with conflict checks and idempotency protection.
- Atomic credit transfers when a booking is completed.
- Booking-gated messaging, notifications, and reviews.
- Admin analytics, review moderation, and user suspension controls.
- Backend protection against administrators suspending themselves.
- Durable booking email jobs with retries and expiry.
- Location-aware discovery: Browse requests the browser location and searches within 25 km.

Clerk owns email verification. SkillSwap does not send verification OTPs; its notification service sends only booking-related messages.

## Repository structure

```text
skillswap/
├── client/                 React/Vite frontend
│   ├── src/api/            Axios API client
│   ├── src/components/     Shared UI and onboarding modal
│   ├── src/pages/          Application pages
│   └── src/redux/          Auth and notification state
├── server/                 Express API
│   ├── controllers/        Request handlers
│   ├── middleware/         Clerk authentication and admin checks
│   ├── models/             Mongoose models
│   ├── routes/             API routes
│   ├── services/           Matching integration and email worker
│   ├── scripts/            Admin and maintenance utilities
│   └── tests/              Jest tests
├── matching-service/       Flask matching microservice
├── notification-service/   Flask/Resend notification microservice
├── docker-compose.yml      Local orchestration
└── README.md
```

## Prerequisites

- Node.js 20 or newer
- Python 3.11 or newer
- MongoDB 6 or newer configured as a replica set, or MongoDB Atlas
- A Clerk application with publishable and secret keys
- A Resend account if booking email delivery is required

## Local development

### MongoDB

For a local replica set:

```bash
mongod --replSet rs0 --dbpath /path/to/data
mongosh
```

Then run `rs.initiate()` once. MongoDB Atlas supports replica-set transactions by default.

### API

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

Configure at least:

```env
MONGO_URI=mongodb://localhost:27017/skillswap?replicaSet=rs0
CLERK_SECRET_KEY=sk_test_replace_me
PORT=5000
CLIENT_ORIGINS=http://localhost:5173
MATCHING_SERVICE_URL=http://localhost:6000
NOTIFICATION_SERVICE_URL=http://localhost:7000
NOTIFICATION_SERVICE_API_KEY=local-shared-secret
```

### Client

```bash
cd client
npm install
cp .env.example .env.local
npm run dev
```

Configure `client/.env.local`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_CLERK_PUBLISHABLE_KEY=pk_test_replace_me
```

Open <http://localhost:5173>. `BrowserRouter` sits above `ClerkProvider`, and Clerk receives React Router `routerPush`/`routerReplace` callbacks so OTP steps stay inside the SPA.

### Matching service

```bash
cd matching-service
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python app.py
```

It exposes `GET /` and `POST /match`. The API has an internal fallback if this service is unavailable.

### Notification service

```bash
cd notification-service
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```

Configure:

```env
PORT=7000
RESEND_API_KEY=re_replace_me
EMAIL_FROM=SkillSwap <onboarding@resend.dev>
NOTIFICATION_SERVICE_API_KEY=local-shared-secret
```

Supported email types are `BOOKING_CREATED`, `BOOKING_ACCEPTED`, `BOOKING_DECLINED`, and `BOOKING_COMPLETED`.

## Docker Compose

```bash
docker compose up --build
```

Default addresses:

- Client: <http://localhost:8080>
- API: <http://localhost:5000>
- Matching service: <http://localhost:6000>
- Notification service: <http://localhost:7000>
- MongoDB: `localhost:27017`, replica set `rs0`

Compose reads these root-level variables when provided:

```env
RESEND_API_KEY=re_replace_me
EMAIL_FROM=SkillSwap <onboarding@resend.dev>
LOCAL_NOTIFICATION_SERVICE_API_KEY=local-shared-secret
LOCAL_JWT_SECRET=legacy-local-secret
GOOGLE_CLIENT_ID=
VITE_API_URL=http://localhost:5000/api
```

The current client Docker build forwards `VITE_API_URL` and the legacy Google argument, but not the Clerk publishable key. For Docker-based Clerk authentication, extend the client build arguments with `VITE_CLERK_PUBLISHABLE_KEY`; otherwise use the local Vite workflow above.

## Environment variables

### Client (`client/.env.local`)

| Variable | Required | Description |
|---|---:|---|
| `VITE_API_URL` | Yes | API base URL, ending in `/api` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk browser publishable key |

### API (`server/.env`)

| Variable | Required | Description |
|---|---:|---|
| `MONGO_URI` | Yes | MongoDB replica-set connection string |
| `CLERK_SECRET_KEY` | Yes | Clerk server secret for `@clerk/express` |
| `PORT` | No | Defaults to `5000` |
| `CLIENT_ORIGINS` | No | Comma-separated allowed browser origins |
| `MATCHING_SERVICE_URL` | No | Matching service URL |
| `MATCHING_SERVICE_TIMEOUT_MS` | No | Matching request timeout |
| `NOTIFICATION_SERVICE_URL` | No | Notification service URL |
| `NOTIFICATION_SERVICE_API_KEY` | No | Shared API/service secret |
| `NOTIFICATION_SERVICE_TIMEOUT_MS` | No | Notification request timeout |
| `EMAIL_WORKER_INTERVAL_MS` | No | Queue polling interval; defaults to `5000` ms |
| `TRUST_PROXY_HOPS` | No | Reverse-proxy hop count |
| `BLOCKED_EMAIL_DOMAINS` | No | Additional domains for legacy auth validation |

### Notification service (`notification-service/.env`)

| Variable | Required | Description |
|---|---:|---|
| `RESEND_API_KEY` | Yes for delivery | Resend API key |
| `EMAIL_FROM` | Yes for delivery | Verified sender address |
| `NOTIFICATION_SERVICE_API_KEY` | Yes | Must match the API secret |
| `PORT` | No | Defaults to `7000` |

Never commit `.env`, `.env.local`, Clerk secret keys, database credentials, or Resend keys.

## Authentication and onboarding flow

1. The user authenticates with Clerk using email OTP or a configured OAuth provider.
2. Clerk navigates within React Router using `routerPush`/`routerReplace`.
3. The first authenticated API request runs Clerk sync middleware, which links or creates the MongoDB `User` record.
4. The client fetches `GET /api/users/me` and stores the profile in Redux.
5. If both `skillsWanted` and `skillsOffered` are empty, `OnboardingModal` appears.
6. Saving calls `PUT /api/users/me/skills`, updates Redux, and navigates to `/dashboard`.
7. Clerk, not the API or notification service, sends verification codes.

## Location-aware discovery

The Browse page requests browser geolocation when available, saves it through `PATCH /api/users/me/location`, and then requests `GET /api/users?lng=<longitude>&lat=<latitude>`. Coordinates are always stored in GeoJSON order: `[longitude, latitude]`.

The `User.location` field uses a sparse MongoDB `2dsphere` index. With valid coordinates, the API uses `$geoNear` with a 25,000-meter maximum distance and returns `distanceKm` for each nearby member. Suspended users and the requester are excluded. Members without valid location data are excluded from the geospatial result.

If location permission is unavailable, query coordinates are invalid, the geospatial index is unavailable, or no nearby users are found, the API returns a safe `200` response containing non-suspended users as a compatibility fallback. The Browse page keeps cards visible even when a member has no listed skills.

## API overview

Protected routes require a Clerk session token. The API is mounted under `/api`.

| Area | Routes |
|---|---|
| Users | `GET /users?lng=<longitude>&lat=<latitude>`, `GET /users/me`, `PATCH /users/me/location`, `PUT /users/me`, `PUT /users/me/skills`, `PUT /users/me/profile` |
| Bookings | `GET /bookings`, `POST /bookings`, `PATCH /bookings/:id/status`, `PATCH /bookings/:id/complete` |
| Credits | `GET /credits/history` |
| Matching | `GET /matches` |
| Reviews | `POST /reviews`, `GET /reviews/mine`, `GET /reviews/:userId`, `GET /reviews/user/:userId` |
| Messages | `GET /messages/unread`, `GET /messages/:userId`, `POST /messages/:userId` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read` |
| Admin | `GET /admin/stats`, `GET /admin/users`, `PATCH /admin/users/:id/status`, `DELETE /admin/reviews/:id` |
| Health | `GET /health` |

The admin status endpoint accepts `active` or `suspended`. An administrator cannot suspend their own account; the backend enforces this independently of the dashboard UI.

## Email queue

Booking notifications are persisted as `EmailJob` documents. The API worker claims pending jobs, calls the notification service, retries failures with backoff, and marks permanently failed jobs as `dead`. MongoDB TTL indexes remove expired jobs.

Verification email jobs are explicitly rejected because Clerk owns that flow.

## Admin and maintenance commands

Promote a user to admin:

```bash
cd server
node scripts/makeAdmin.js user@example.com
```

Remove legacy email-verification fields and jobs from an older database:

```bash
npm run migrate:remove-email-verification
```

## Testing and checks

```bash
cd server
npm test -- --runInBand

cd ../client
npm run lint
npm run build

cd ../matching-service
python -m unittest -v

cd ../notification-service
python -m unittest -v

cd ..
docker compose config
```

## Deployment notes

- Deploy `client` as a Vite static site with `VITE_API_URL` and `VITE_CLERK_PUBLISHABLE_KEY` set at build time.
- Deploy `server` with `npm ci` and `node server.js`; provide `MONGO_URI`, `CLERK_SECRET_KEY`, allowed client origins, and service URLs.
- Deploy the matching and notification services separately or use their Dockerfiles.
- Use a MongoDB replica set in production.
- Configure Clerk redirect URLs and allowed origins for the deployed client.
- Use a verified Resend sender and strong, separate service secrets.

## Attribution

SkillSwap is maintained by [Mahdi Hasan](https://github.com/eeemrann).
