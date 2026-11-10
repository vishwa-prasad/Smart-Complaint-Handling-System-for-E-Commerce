# 🎯 Smart Complaint Management System

A full-stack AI-powered complaint management system that automatically classifies customer complaints using a trained BiLSTM deep learning model, assigns them to support agents, and tracks resolution in real time.

---

## ✨ Features

### Customer Side
- Submit complaints with text, image attachments, and channel selection
- AI automatically classifies the complaint into a category and assigns priority
- Real-time complaint status tracker (Submitted → Under Review → Resolved)
- SLA deadline tracking per complaint
- Live chat with assigned support agent
- Satisfaction rating after resolution
- View and filter all past complaints by category and status

### Agent / Employee Side
- Dashboard showing assigned complaints with SLA indicators
- Update complaint status, add internal and resolution notes
- Chat with customers directly on each complaint
- Reopen complaints within 7 days of resolution

### Admin Side
- Full user management — role changes, enable/disable accounts
- Category-to-agent assignment with load balancing (least-loaded agent gets new complaints)
- Analytics dashboard — complaint volume, category breakdown, SLA breach rate, average resolution time
- Canned response templates for common replies

### Load Balancing
When a complaint is submitted, the system automatically routes it to the least-loaded agent in that category's pool:

1. Fetch all agents assigned to the complaint's category
2. Count each agent's currently open complaints (status: Open, In Progress, or Escalated)
3. Assign the complaint to the agent with the fewest open cases

If no agents are assigned to a category yet, it falls back to the legacy single-agent assignment. Admins can assign multiple agents per category from the **Category → Agent Assignment** page.

### AI Classification
- **Primary**: BiLSTM neural network trained on complaint data using FastText word embeddings
- **Fallback**: Rule-based keyword scoring when model is unavailable
- Classifies into 6 categories: Account Issue, Payment Issue, Delivery Issue, Product Issue, Refund Request, Customer Service
- Priority assigned automatically: High / Medium / Low
- Auto-generated resolution advice per category and priority

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | FastAPI, Python 3.13 |
| Database | SQLite (via SQLAlchemy ORM) |
| Authentication | JWT (python-jose) |
| ML Model | BiLSTM (TensorFlow/Keras) + FastText embeddings (gensim) |
| Real-time Chat | WebSockets (FastAPI) |
| Email | SMTP (email_service.py) |

---

## 📁 Project Structure

```
complaint-system/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── ml_service.py            # AI classification engine
│   ├── models.py                # SQLAlchemy DB models
│   ├── schemas.py               # Pydantic request/response schemas
│   ├── auth.py                  # JWT auth utilities
│   ├── database.py              # DB connection setup
│   ├── email_service.py         # Email notifications
│   ├── seed_admin.py            # Seed demo accounts
│   ├── requirements.txt
│   ├── models/
│   │   ├── complaint_classifier.keras   # Trained BiLSTM model
│   │   ├── tokenizer.pkl                # Keras tokenizer
│   │   └── category_encoder.pkl         # Label encoder
│   └── routers/
│       ├── auth_router.py       # /api/auth — login, register
│       ├── complaints.py        # /api/complaints — submit, track
│       ├── admin.py             # /api/admin — users, assignments, analytics
│       └── chat.py              # /api/chat — WebSocket chat
│
└── frontend/
    ├── src/
    │   ├── pages/               # Login, Register, Dashboard, Submit, Admin...
    │   ├── components/          # ComplaintCard, ChatPanel, SLA badge...
    │   ├── context/             # AuthContext
    │   └── api/axios.js         # Axios instance
    ├── package.json
    └── vite.config.js
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd complaint-system
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
```

Seed the database with demo accounts:
```bash
python seed_admin.py
```

Start the backend server:
```bash
uvicorn main:app --reload --port 8001
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 👤 Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.com | admin123 |
| Support Agent | agent@demo.com | agent123 |
| Customer | john@demo.com | user123 |
| Customer | jane@demo.com | user123 |

---

## 🤖 ML Model Details

The classification model was trained on a labeled e-commerce complaint dataset.

**Architecture:**
```
Input (80 tokens)
  → Embedding Layer (vocab: 4576, dim: 100)  ← FastText-initialized weights
  → Bidirectional LSTM (128 units × 2)
  → Dense (64, ReLU)
  → Dropout (0.4)
  → Dense (6, Softmax)
```

**Training pipeline** (`backend/src/`):
1. `data_preprocessing.py` — cleans text, label-encodes categories
2. `embeddings.py` — trains FastText embeddings, builds embedding matrix
3. Model trained with the embedding matrix as the initial Embedding layer weights

**At inference time**, only 3 files are needed — the FastText model is not required since its weights are already baked into `complaint_classifier.keras`.

**Categories the model classifies:**

| Dataset Label | Display Name |
|---|---|
| Account/Login Issue | Account Issue |
| Customer Service Issue | Customer Service |
| Delivery Issue | Delivery Issue |
| Payment Issue | Payment Issue |
| Product Issue | Product Issue |
| Refund Issue | Refund Request |

---

## 🔌 API Overview

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login and get JWT token |
| GET | /api/auth/me | Get current user |
| POST | /api/complaints/ | Submit a complaint (AI classifies) |
| GET | /api/complaints/my | Get user's own complaints |
| GET | /api/complaints/{id} | Get complaint detail |
| GET | /api/admin/users | List all users (admin) |
| PATCH | /api/admin/users/{id}/role | Change user role (admin) |
| GET | /api/admin/assignments | List category assignments (admin) |
| GET | /api/admin/analytics | Dashboard analytics (admin) |
| WS | /api/chat/{complaint_id} | WebSocket chat |

---

## 📊 SLA Policy

| Priority | Resolution Deadline |
|---|---|
| High | 24 hours |
| Medium | 48 hours |
| Low | 72 hours |

Complaints breaching their SLA deadline (3 days) are handled automatically:

- **Flagged** — `sla_breached` is set to `true` for all unresolved complaints past the deadline
- **Priority upgraded** — Medium and Low priority complaints are automatically raised to **High**
- **Auto-escalated** — Open High-priority complaints (including just-upgraded ones) have their status changed to **Escalated**

The SLA scheduler runs every hour and also checks on server startup.
