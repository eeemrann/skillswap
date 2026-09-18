# SkillSwap

A modern peer-to-peer skill-bartering platform where users exchange skills using **time credits** instead of money. Earn credits by teaching, spend credits by learning. Built with a scalable microservices architecture featuring real-time notifications, smart skill matching, and a seamless booking workflow.

**Live Demo:**
- **Frontend:** https://skillswap-rho-five.vercel.app
- **Backend API:** https://skillswap-1-x54c.onrender.com
- **Matching Service:** https://skillswap-vmma.onrender.com

> ⚠️ **Note:** Backend services run on Render's free tier and may take 30–50 seconds to wake up after inactivity.

---

## ✨ Key Features

### Core Functionality
- **JWT Authentication** — Secure register/login with bcrypt password hashing
- **User Profiles** — Manage skills you offer and skills you want to learn
- **Skill Browsing** — Discover what other users can teach
- **Smart Matching Engine** — AI-powered recommendations based on skill overlap, availability, and location
- **Booking System** — Request → Accept/Decline → Complete workflow with role-based permissions
- **Credit Ledger** — Transparent transaction history and credit balance tracking

### Advanced Features
- **Reviews & Ratings** — Build reputation through user feedback
- **Messaging** — Direct communication with skill partners
- **Email Notifications** — Stay updated on booking requests, completions, and messages
- **Rate Limiting** — Protect against brute-force attacks on auth endpoints
- **Role-Based Authorization** — Server-side validation (not just UI hiding) — e.g., only the provider can accept a booking

---

## 🏗️ Architecture

```mermaid
flowchart TB
    subgraph Client["Frontend"]
        A[React + Redux SPA<br/>Vite + React Router]
    end
    subgraph Services["Core Services"]
        B["Auth & User Management<br/>JWT + bcrypt"]
        C["Skill Bookings<br/>Credit Transfers"]
        D["Reviews & Messaging"]
    end
    subgraph Microservices["Microservices"]
        E["Skill Matching<br/>Python/Flask"]
        F["Email Notifications<br/>Node/Express"]
    end
    subgraph Data["Data Layer"]
        G[(MongoDB)]
        H["Email Service<br/>SMTP"]
    end

    A -->|REST/JSON| B
    A -->|REST/JSON| Services
    B --> G
    Services --> G
    Services -->|REST| E
    E --> G
    Services -->|REST| F
    F --> H
```

**Architecture Rationale:**
- **Single API Gateway:** The Node.js backend is the primary entry point for the frontend, simplifying client logic and enabling centralized auth/logging.
- **Isolated Microservices:** The Python matching service is stateless and replicable — it only reads skill data and returns scores, allowing independent scaling and updates.
- **Notification Service:** Decoupled from core API, handles async email delivery without blocking request-response cycles.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Redux Toolkit, React Router v7, Axios, Vite |
| **Backend** | Node.js 20+, Express 5, MongoDB 8, Mongoose |
| **Matching Microservice** | Python 3.11+, Flask, Gunicorn |
| **Notification Service** | Node.js, Express, SMTP |
| **Authentication** | JWT (jsonwebtoken), bcryptjs |
| **Security** | CORS, express-rate-limit, input validation (validator.js) |
| **Containerization** | Docker, Docker Compose |
| **Database** | MongoDB Atlas (cloud), local MongoDB for development |
| **Deployment** | Vercel (frontend), Render (backend + microservices) |
| **CI/CD** | GitHub Actions |

---

## 📁 Project Structure

```
skillswap/
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── api/              # Axios instance with JWT interceptor
│   │   ├── redux/            # Redux store + slices (auth, users, bookings, etc.)
│   │   ├── pages/            # Page components (Login, Dashboard, Browse, Bookings, etc.)
│   │   ├── components/       # Reusable UI components
│   │   └── App.jsx           # Main router setup
│   ├── vite.config.js
│   ├── package.json
│   └── Dockerfile
│
├── server/                    # Node/Express API (Main gateway)
│   ├── models/               # Mongoose schemas (User, Booking, Credit, Review, Message)
│   ├── controllers/          # Business logic for each route
│   ├── routes/               # Express route definitions
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── bookingRoutes.js
│   │   ├── creditRoutes.js
│   │   ├── matchRoutes.js
│   │   ├── reviewRoutes.js
│   │   ├── messageRoutes.js
│   │   └── adminRoutes.js
│   ├── middleware/           # JWT auth, error handling
│   ├── app.js               # Express app setup
│   ├── server.js            # Server entry point (MongoDB connection)
│   ├── package.json
│   ├── .env.example
│   └── Dockerfile
│
├── matching-service/         # Python/Flask microservice
│   ├── app.py               # Skill matching algorithm
│   ├── requirements.txt
│   ├── .dockerignore
│   └── Dockerfile
│
├── notification-service/     # Email notification microservice
│   ├── app.js
│   ├── package.json
│   ├── .env.example
│   └── Dockerfile
│
├── docker-compose.yml        # Multi-container orchestration
├── .github/workflows/        # CI/CD pipeline
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 20+ and npm/yarn
- **Python** 3.11+ and pip
- **MongoDB** (free Atlas cluster or local instance)
- **Docker** & **Docker Compose** (optional, for containerized setup)

### Installation & Local Development

#### 1. Backend (Node.js API)

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm run dev
```

The backend will run on `http://localhost:5000`.

#### 2. Matching Microservice (Python)

```bash
cd matching-service
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

pip install -r requirements.txt
python app.py
```

The matching service will run on `http://localhost:6000`.

#### 3. Notification Service (Node.js)

```bash
cd notification-service
npm install
cp .env.example .env
# Edit .env with your SMTP credentials
npm run dev
```

The notification service will run on `http://localhost:7000`.

#### 4. Frontend (React)

```bash
cd client
npm install
npm run dev
```

The frontend will run on `http://localhost:5173` (Vite default).

### Environment Variables

**`server/.env`**
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/skillswap
JWT_SECRET=your_jwt_secret_key_here_change_in_production
PORT=5000
MATCHING_SERVICE_URL=http://localhost:6000
NOTIFICATION_SERVICE_URL=http://localhost:7000
NODE_ENV=development
```

**`notification-service/.env`**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM=noreply@skillswap.com
PORT=7000
```

**`client/.env.local` (create locally)**
```env
VITE_API_URL=http://localhost:5000/api
```


## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create a new user account |
| `POST` | `/api/auth/login` | Authenticate and receive JWT token |

### Users & Skills
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | Browse all users and their offered skills |
| `GET` | `/api/users/me` | Get current user's profile |
| `PUT` | `/api/users/me/skills` | Update skills offered and wanted |
| `GET` | `/api/users/:id` | Get specific user's profile |

### Bookings
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/bookings` | Request a skill swap |
| `GET` | `/api/bookings` | List your bookings |
| `GET` | `/api/bookings/:id` | Get booking details |
| `PATCH` | `/api/bookings/:id/status` | Accept or decline a booking (provider only) |
| `PATCH` | `/api/bookings/:id/complete` | Mark as complete & transfer credits (requester only) |

### Credits & Transactions
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/credits/history` | View transaction history |
| `GET` | `/api/credits/balance` | Get current credit balance |

### Smart Matching
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/matches` | Get recommended skill partners |

### Reviews & Ratings
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/reviews` | Leave a review for a completed booking |
| `GET` | `/api/reviews/:userId` | Get reviews for a user |

### Messaging
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/messages` | Send a message to a user |
| `GET` | `/api/messages/:userId` | Fetch conversation history |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/stats` | Platform statistics (admin only) |
| `GET` | `/api/admin/users` | List all users (admin only) |

---

## 🧪 Testing

### Backend Tests
Run Jest + Supertest suite:
```bash
cd server
npm test
```

Tests cover:
- Authentication flows (register, login, JWT validation)
- Authorization (role-based checks)
- Core booking logic
- Credit ledger consistency

---

## 🔄 CI/CD Pipeline

Every push to `main` triggers GitHub Actions:
1. Install dependencies for backend, frontend, and matching service
2. Run ESLint for code quality
3. Execute backend test suite
4. Build frontend and backend Docker images
5. Fail fast if any step breaks

Check `.github/workflows/ci.yml` for pipeline details.

---

## 🐳 Docker Deployment

### Build Individual Images
```bash
# Backend
docker build -t skillswap-server ./server

# Matching Service
docker build -t skillswap-matching ./matching-service

# Notification Service
docker build -t skillswap-notification ./notification-service

# Frontend
docker build -t skillswap-client ./client
```

### Push to Registry
```bash
docker tag skillswap-server your-registry/skillswap-server:latest
docker push your-registry/skillswap-server:latest
```

---

## 📊 Skill Matching Algorithm

The matching service uses a multi-factor scoring system:

1. **Skill Overlap** (primary) — How many skills you want does the candidate offer?
2. **Availability Match** (bonus +0.25) — Do your schedules overlap?
3. **Location Match** (bonus +0.25) — Are you in the same city?

Results are ranked by weighted score (descending), ensuring the best matches appear first.

---

## 🔒 Security Best Practices

- ✅ **Passwords:** Hashed with bcryptjs (salt rounds: 10)
- ✅ **JWT Tokens:** Short-lived (configurable expiration)
- ✅ **Rate Limiting:** 20 requests per 15 minutes on `/api/auth`
- ✅ **Input Validation:** All inputs validated with validator.js
- ✅ **CORS:** Enabled and configured for frontend origin
- ✅ **Role-Based Authorization:** Enforced at the controller level
- ✅ **Environment Secrets:** Stored in `.env`, never committed to Git

---

## 🚧 Known Limitations & Future Improvements

### Current Limitations
- **No Atomic Transactions:** Credit transfers are sequential writes; under very high concurrency, a race condition is theoretically possible (mitigation: implement MongoDB transactions).
- **No Real-Time Updates:** Booking status changes require manual page refresh (solution: integrate WebSockets or server-sent events).
- **Simple Matching Algorithm:** Set-overlap only; future versions could factor in user ratings, availability patterns, or geographic distance.
- **Cold Start Delays:** Free-tier hosting introduces 30–50 second startup times (solution: upgrade to always-on instances in production).
- **No Pagination on Browse:** All users loaded at once (scale concern for 10,000+ users).

### Planned Features
- [ ] Real-time notifications via WebSockets
- [ ] Advanced search filters (availability, rating, distance)
- [ ] Video call integration for initial skill meetings
- [ ] Gamification (badges, leaderboards)
- [ ] Mobile app (React Native)
- [ ] Payment gateway for premium features
- [ ] Analytics dashboard for admins

---

## 📝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open-source and available under the ISC License.

---

## 👨‍💻 Author

**Mahdi Hasan**  
GitHub: [@eeemrann](https://github.com/eeemrann)

---

## 🤝 Support

Found a bug or have a feature request? Open an [issue](https://github.com/eeemrann/skillswap/issues) on GitHub.

For questions, feel free to start a [discussion](https://github.com/eeemrann/skillswap/discussions).
