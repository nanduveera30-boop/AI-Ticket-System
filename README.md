# Confidence-Governed AI Ticket Resolution System

A production-ready MVP that uses RAG (Retrieval-Augmented Generation), confidence scoring, and a risk engine to automatically triage and resolve support tickets — without human intervention when confidence is high enough.

Built as part of my learning journey into applied AI systems using FastAPI, PostgreSQL, FAISS, and Sentence Transformers.

---

## What It Does

Instead of routing every support ticket to a human agent, this system:

1. Embeds the ticket using a pre-trained sentence transformer model
2. Searches a FAISS vector store for similar past tickets (RAG)
3. Scores the ticket across 4 dimensions: classification probability, similarity, historical success rate, and risk
4. Computes a weighted confidence score
5. Makes a decision: **AUTO_RESOLVE**, **SUGGEST**, or **ESCALATE**
6. Returns a full explanation with confidence breakdown

The threshold for auto-resolution is configurable via `.env`.

---

## Project Structure

```
confidence-ai-ticket-system/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entry point
│   │   ├── core/
│   │   │   └── config.py            # Settings from .env
│   │   ├── db/
│   │   │   ├── database.py          # SQLAlchemy engine + session
│   │   │   └── models.py            # Ticket, Prediction, AuditLog tables
│   │   ├── routes/
│   │   │   ├── tickets.py           # POST /tickets, POST /process-ticket, GET /tickets/{id}
│   │   │   └── metrics.py           # GET /metrics, GET /health
│   │   ├── services/
│   │   │   ├── ai_pipeline.py       # Orchestrates the full AI flow
│   │   │   ├── embeddings.py        # SentenceTransformer (loaded once)
│   │   │   ├── rag.py               # FAISS vector store + similarity search
│   │   │   ├── confidence.py        # Weighted confidence formula
│   │   │   ├── risk.py              # Risk rules engine
│   │   │   └── decision.py         # AUTO_RESOLVE / SUGGEST / ESCALATE logic
│   │   ├── schemas/
│   │   │   └── ticket.py            # Pydantic request/response models
│   │   ├── utils/
│   │   │   └── logger.py            # Structured logging
│   │   └── workers/
│   │       └── tasks.py             # Background tasks (persist predictions + audit logs)
│   ├── data/
│   │   └── seed_tickets.csv         # 20 real-world support ticket examples
│   ├── scripts/
│   │   ├── seed.py                  # Load CSV and process through API
│   │   └── batch_simulate.py        # Generate N random tickets + print summary
│   ├── .env.example                 # Template for environment variables
│   ├── requirements.txt
│   ├── Dockerfile
│   └── docker-compose.yml
├── frontend/                        # Legacy vanilla JS prototype (kept for reference)
│   ├── index.html
│   ├── style.css
│   └── app.js
├── frontend-react/                  # Production React + Vite dashboard
│   ├── src/
│   │   ├── api/                     # Axios API layer
│   │   ├── components/              # React components
│   │   ├── hooks/                   # Custom hooks (metrics polling, ticket log)
│   │   └── utils/                   # Constants, helpers
│   ├── vite.config.js
│   └── package.json
├── .gitignore
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | FastAPI + Uvicorn |
| Database | PostgreSQL + SQLAlchemy |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 |
| Vector Search | FAISS (in-memory) |
| Confidence Engine | Custom weighted formula |
| Risk Engine | Rule-based (priority + user type) |
| Frontend | Vanilla JS + Chart.js |
| Containerization | Docker + Docker Compose |

---

## Confidence Formula

```
confidence = 0.35 * classification_prob
           + 0.35 * similarity_score
           + 0.20 * historical_success
           + 0.10 * risk_adjustment
```

- `classification_prob` — keyword heuristic, normalized to [0.30, 0.95]
- `similarity_score` — average cosine similarity of top-3 RAG matches
- `historical_success` — structured mock at 0.8 (represents past resolution rate)
- `risk_adjustment` — 0.2 for LOW risk, 0.0 for HIGH risk

---

## Decision Rules

| Condition | Action |
|---|---|
| confidence > 0.92 AND risk == LOW | AUTO_RESOLVE |
| confidence > 0.60 | SUGGEST |
| otherwise | ESCALATE |

---

## Risk Rules

| Condition | Risk Level |
|---|---|
| priority == P1 | HIGH |
| user_type == VIP | HIGH |
| everything else | LOW |

---

## Getting Started

### Option 1 — Docker (easiest)

```bash
git clone https://github.com/chandu1234678/confidence-ai-ticket-system.git
cd confidence-ai-ticket-system/backend

# Copy env template
cp .env.example .env

docker-compose up --build
```

API will be live at `http://localhost:8000`

### Option 2 — Local (Windows)

```bash
cd backend

py -m venv venv
venv\Scripts\activate
py -m pip install --upgrade pip
pip install -r requirements.txt

# Make sure PostgreSQL is running, then:
uvicorn app.main:app --reload
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/tickets` | Create a ticket (no AI processing) |
| POST | `/process-ticket` | Create + run full AI pipeline |
| GET | `/tickets/{id}` | Get ticket by ID |
| GET | `/metrics` | Aggregated system metrics |
| GET | `/health` | Health check |

### Example Request

```bash
curl -X POST http://localhost:8000/process-ticket \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cannot login to account",
    "description": "User cannot login after password reset. Multiple attempts failed.",
    "priority": "P2",
    "user_type": "STANDARD"
  }'
```

### Example Response

```json
{
  "ticket_id": 1,
  "confidence": 0.7525,
  "risk": "LOW",
  "action": "SUGGEST",
  "explanation": {
    "reason": "Confidence 0.7525 is moderate (>0.6). Suggesting resolution for human review.",
    "similarity_matches": [],
    "confidence_breakdown": {
      "classification_prob": 0.69,
      "similarity_score": 0.0,
      "historical_success": 0.8,
      "risk_adjustment": 0.2
    }
  }
}
```

---

## Seed Data + Simulation

```bash
# Load the 20 real-world tickets from CSV
python scripts/seed.py

# Run a batch simulation of 50 random tickets
python scripts/batch_simulate.py --count 50
```

---

## Frontend Dashboard (React + Vite)

A proper React app lives in `frontend-react/`. It replaces the vanilla prototype with a component-based, scalable architecture.

### Run the frontend

```bash
cd frontend-react

# Copy env (only needed if API is not on localhost:8000)
cp .env.example .env

npm install
npm run dev
```

Open `http://localhost:5173`

### Build for production

```bash
npm run build
# Output goes to frontend-react/dist/
```

### Frontend structure

```
frontend-react/
├── src/
│   ├── api/
│   │   ├── client.js          # Axios instance with base URL from env
│   │   └── tickets.js         # API call functions
│   ├── components/
│   │   ├── Header.jsx          # Health badge + title
│   │   ├── MetricsRow.jsx      # 5 metric cards
│   │   ├── Charts.jsx          # Donut + Line charts (Chart.js)
│   │   ├── TicketForm.jsx      # Submit form + batch simulation
│   │   ├── ResultPanel.jsx     # Confidence breakdown + RAG matches
│   │   └── TicketLog.jsx       # Live table of processed tickets
│   ├── hooks/
│   │   ├── useMetrics.js       # Polls /metrics every 10s
│   │   └── useTicketLog.js     # Manages in-memory ticket log + history
│   ├── utils/
│   │   └── constants.js        # Batch tickets, color maps
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── .env.example
├── vite.config.js
└── package.json
```

Features:
- Live metrics cards (total, auto-resolved %, escalated %, avg confidence)
- Donut chart — decision distribution
- Line chart — confidence history per ticket (last 30)
- Single ticket submission form with full result breakdown
- Batch simulation button (10 pre-defined tickets)
- Polls metrics every 10 seconds automatically

---

## Environment Variables

Create a `.env` file in the `backend/` folder:

```env
DATABASE_URL=postgresql://postgres:postgres@db:5432/tickets
MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
CONFIDENCE_THRESHOLD=0.92
```

---

## What I Learned

- How to build a RAG pipeline from scratch using FAISS and sentence transformers
- Designing a multi-factor confidence scoring system with explainability
- Structuring a FastAPI project for scalability (services, routes, workers, schemas separated)
- Using SQLAlchemy with PostgreSQL for audit trails and predictions
- Containerizing a multi-service app with Docker Compose

---

## Future Improvements

- [ ] Persist FAISS index to disk so embeddings survive restarts
- [ ] Replace mock historical success rate with real DB-computed value
- [ ] Add Celery + Redis for async task processing at scale
- [ ] Add authentication (JWT) to the API
- [ ] Train a real classifier instead of keyword heuristic
- [ ] Add unit and integration tests

---

## Author

Made by a student learning applied AI engineering. Feedback welcome.
