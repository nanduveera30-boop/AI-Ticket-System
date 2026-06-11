# Confidence-Governed AI Ticket Resolution System

A production-ready system that uses RAG, a locally trained DistilBERT classifier, and a multi-factor confidence engine to automatically triage and resolve support tickets — with full explainability, voice input, duplicate detection, and an admin portal.

Built with FastAPI, PostgreSQL, FAISS, Sentence Transformers, Whisper, and React + Vite.

---

## System Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend - React + Vite"]
        UI[Dashboard / Tickets / Audit]
        VA[Voice Assistant]
        AP[Admin Portal]
    end

    subgraph API["Backend - FastAPI"]
        AUTH[Auth Routes /auth]
        TR[Ticket Routes /tickets]
        VR[Voice Routes /voice]
        MR[Metrics Routes /metrics]
        AR[Admin Routes /admin]
    end

    subgraph AI["AI Pipeline"]
        EMB[Embeddings all-MiniLM-L6-v2]
        FAISS[FAISS Vector Store RAG]
        CLF[DistilBERT Classifier]
        ZS[Zero-Shot BART]
        CONF[Confidence Engine]
        RISK[Risk Engine]
        DEC[Decision Engine]
        WHISPER[Whisper Base Voice]
    end

    subgraph DB["PostgreSQL"]
        T[(tickets)]
        P[(predictions)]
        AL[(audit_logs)]
        U[(users)]
    end

    UI --> TR
    UI --> MR
    VA --> VR
    AP --> AR
    Frontend --> AUTH

    TR --> AI
    VR --> WHISPER
    WHISPER --> TR

    EMB --> FAISS
    FAISS --> CONF
    CLF --> CONF
    ZS --> CONF
    RISK --> CONF
    CONF --> DEC

    TR --> DB
    AR --> DB
    MR --> DB
```

---

## AI Pipeline Flow

```mermaid
flowchart LR
    A([Ticket Input]) --> B[Generate Embedding\nall-MiniLM-L6-v2]
    B --> C{FAISS Index\nEmpty?}
    C -- No --> D[Search Top-3\nSimilar Tickets]
    C -- Yes --> E[similarity = 0]
    D --> F[Avg Cosine\nSimilarity Score]
    E --> F

    A --> G[DistilBERT Classifier\nYour Trained Model]
    G --> H[classification_prob\n= score x resolvability]

    A --> I[BART Zero-Shot\nFinancial Category]

    A --> J[Risk Engine\nP1 or VIP = HIGH]
    J --> K[risk_adjustment\nLOW=0.2 HIGH=0.0]

    F --> L[Confidence Formula]
    H --> L
    K --> L

    L --> M{Confidence\nThreshold}
    M -->|above 0.92 AND LOW risk| N([AUTO_RESOLVE])
    M -->|above 0.60| O([SUGGEST])
    M -->|else| P([ESCALATE])

    N --> Q[Persist to DB\nAudit Log]
    O --> Q
    P --> Q
```

---

## Confidence Formula

```mermaid
graph LR
    A[classification_prob x 0.35] --> E[Confidence Score]
    B[similarity_score x 0.35] --> E
    C[historical_success x 0.20] --> E
    D[risk_adjustment x 0.10] --> E
    E --> F{Above 0.92 AND LOW risk?}
    F -->|Yes| G[AUTO_RESOLVE]
    F -->|No, above 0.60| H[SUGGEST]
    F -->|No| I[ESCALATE]
```

---

## Voice Pipeline

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as FastAPI
    participant W as Whisper Base
    participant AI as AI Pipeline
    participant DB as PostgreSQL

    U->>FE: Click Record
    FE->>FE: Capture audio (WebM)
    U->>FE: Click Stop
    FE->>API: POST /voice/process (audio blob)
    API->>W: transcribe_audio(bytes)
    W-->>API: transcript text
    API->>API: extract_ticket_fields(transcript)
    Note over API: title, priority, user_type extracted
    API->>AI: run_pipeline(fields)
    AI-->>API: confidence, action, explanation
    API->>DB: persist ticket + prediction + audit_log
    API-->>FE: ProcessTicketResponse
    FE-->>U: Show result panel
```

---

## Duplicate Detection Flow

```mermaid
flowchart TD
    A([User submits ticket]) --> B[Frontend calls\nPOST /tickets/check-duplicate]
    B --> C[Generate embedding\nfor new ticket]
    C --> D[FAISS similarity search\ntop-3 matches]
    D --> E{Any match\n≥ 0.92 similarity?}
    E -- Yes --> F[Return is_duplicate=true\n+ Follow Ticket #X message]
    F --> G[Show duplicate alert\nin UI]
    G --> H{User decision}
    H -- Submit Anyway --> I[POST /process-ticket]
    H -- Cancel --> J([Discard])
    E -- No --> I
    I --> K[Full AI Pipeline]
```

---

## Database Schema

```mermaid
erDiagram
    users {
        int id PK
        string username
        string email
        string hashed_password
        string role
        bool is_active
        datetime created_at
    }

    tickets {
        int id PK
        string title
        string description
        string priority
        string user_type
        datetime created_at
    }

    predictions {
        int id PK
        int ticket_id FK
        float confidence
        string risk
        string action
        datetime created_at
    }

    audit_logs {
        int id PK
        int ticket_id FK
        text input_text
        text output_text
        float confidence
        string risk
        string decision
        string actor
        datetime timestamp
    }

    tickets ||--o{ predictions : "has"
    tickets ||--o{ audit_logs : "has"
```

---

## API Endpoints

```mermaid
graph LR
    subgraph Auth
        A1[POST /auth/register]
        A2[POST /auth/token]
        A3[GET /auth/me]
    end

    subgraph Tickets
        T1[POST /tickets]
        T2[POST /process-ticket]
        T3[GET /tickets]
        T4[GET /tickets/:id]
        T5[GET /tickets/:id/prediction]
        T6[POST /tickets/check-duplicate]
        T7[GET /audit-logs]
    end

    subgraph Metrics
        M1[GET /metrics]
        M2[GET /metrics/detailed]
        M3[GET /health]
    end

    subgraph Voice
        V1[POST /voice/transcribe]
        V2[POST /voice/process]
    end

    subgraph Admin
        AD1[GET /admin/users]
        AD2[GET /admin/users/:id]
        AD3[PATCH /admin/users/:id]
        AD4[DELETE /admin/users/:id]
        AD5[GET /admin/system]
        AD6[POST /admin/system/reindex]
        AD7[GET /admin/audit-logs]
    end
```

---

## Project Structure

```
confidence-ai-ticket-system/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py          # Settings from .env
│   │   │   ├── security.py        # JWT + bcrypt auth
│   │   │   └── exceptions.py      # Global error handlers
│   │   ├── db/
│   │   │   ├── database.py        # SQLAlchemy engine + session
│   │   │   └── models.py          # User, Ticket, Prediction, AuditLog
│   │   ├── routes/
│   │   │   ├── auth.py            # Register, login, /me
│   │   │   ├── tickets.py         # CRUD + process + duplicate check
│   │   │   ├── metrics.py         # Summary + detailed + health
│   │   │   ├── voice.py           # Transcribe + voice process
│   │   │   └── admin.py           # User mgmt + system controls
│   │   ├── services/
│   │   │   ├── ai_pipeline.py     # Orchestrates full AI flow
│   │   │   ├── embeddings.py      # all-MiniLM-L6-v2 (loaded once)
│   │   │   ├── rag.py             # FAISS with disk persistence
│   │   │   ├── classifier.py      # Your trained DistilBERT model
│   │   │   ├── confidence.py      # Weighted confidence formula
│   │   │   ├── risk.py            # Rule-based risk engine
│   │   │   ├── decision.py        # AUTO_RESOLVE / SUGGEST / ESCALATE
│   │   │   └── voice.py           # Whisper transcription + field extraction
│   │   ├── schemas/
│   │   │   ├── ticket.py          # Pydantic request/response models
│   │   │   └── auth.py            # User schemas
│   │   ├── utils/
│   │   │   └── logger.py          # Structured logging (structlog)
│   │   ├── workers/
│   │   │   └── tasks.py           # Background persistence tasks
│   │   └── main.py                # FastAPI app, middleware, routers
│   ├── alembic/                   # Database migrations
│   ├── data/
│   │   ├── seed_tickets.csv       # 20 real-world support tickets
│   │   └── training_data.csv      # 95 labeled tickets for training
│   ├── models/
│   │   ├── ticket_classifier/     # Your trained DistilBERT (after training)
│   │   └── label_map.json         # Category ID → label mapping
│   ├── scripts/
│   │   ├── train_classifier.py    # Train YOUR model on CPU
│   │   ├── seed.py                # Load CSV → API
│   │   └── batch_simulate.py      # Generate N random tickets
│   ├── tests/
│   │   ├── conftest.py            # Fixtures + mocked models
│   │   ├── test_auth.py
│   │   ├── test_tickets.py
│   │   ├── test_metrics.py
│   │   └── test_services.py
│   ├── .env.example
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── alembic.ini
├── frontend-react/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js          # Axios instance
│   │   │   ├── tickets.js         # All ticket + metrics API calls
│   │   │   ├── voice.js           # Voice API calls
│   │   │   └── admin.js           # Admin API calls
│   │   ├── components/
│   │   │   ├── Sidebar.jsx        # Navigation sidebar
│   │   │   ├── Topbar.jsx         # Page title + API status
│   │   │   ├── LoginForm.jsx      # Auth screen
│   │   │   ├── MetricsRow.jsx     # 5 stat cards
│   │   │   ├── Charts.jsx         # Donut + Line + Bar charts
│   │   │   ├── TicketForm.jsx     # Submit form + duplicate detection
│   │   │   ├── ResultPanel.jsx    # Confidence breakdown + RAG matches
│   │   │   ├── TicketLog.jsx      # Live session log table
│   │   │   ├── VoiceAssistant.jsx # Record + transcribe + process
│   │   │   └── VoiceWaveform.jsx  # Real-time audio visualizer
│   │   ├── hooks/
│   │   │   ├── useAuth.js         # JWT auth state
│   │   │   ├── useMetrics.js      # Polls /metrics every 10s
│   │   │   ├── useTicketLog.js    # Session ticket history
│   │   │   └── useVoiceRecorder.js# MediaRecorder + Web Audio API
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx  # Metrics + charts + form + log
│   │   │   ├── TicketsPage.jsx    # Paginated ticket list from DB
│   │   │   ├── VoicePage.jsx      # Voice assistant page
│   │   │   ├── AuditPage.jsx      # Full audit log table
│   │   │   ├── MetricsPage.jsx    # Detailed metrics + charts
│   │   │   └── AdminPage.jsx      # User management + system controls
│   │   ├── utils/
│   │   │   └── constants.js       # Batch tickets, color maps
│   │   ├── App.jsx                # Router + auth gate
│   │   └── index.css              # Enterprise dark theme
│   ├── .env.example
│   ├── vite.config.js
│   └── package.json
├── .gitignore
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | FastAPI 0.111 + Uvicorn |
| Database | PostgreSQL 15 + SQLAlchemy 2 |
| Migrations | Alembic |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 |
| Classifier | DistilBERT (your trained model) |
| Zero-Shot | facebook/bart-large-mnli |
| Vector Search | FAISS (persisted to disk) |
| Voice | OpenAI Whisper base (CPU) |
| Rate Limiting | slowapi |
| Monitoring | Prometheus + structlog |
| Frontend | React 19 + Vite 8 |
| Charts | Chart.js + react-chartjs-2 |
| HTTP Client | Axios |
| Containerization | Docker + Docker Compose |

---

## Quick Start

### Option A — Local (Windows)

```bash
# 1. Clone
git clone https://github.com/chandu1234678/confidence-ai-ticket-system.git
cd confidence-ai-ticket-system/backend

# 2. Create venv
py -m venv venv
venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
copy .env.example .env
# Edit .env — set DATABASE_URL to your local PostgreSQL

# 5. Create database
psql -U postgres -c "CREATE DATABASE tickets;"

# 6. Train YOUR classifier (~5-15 min on CPU)
python scripts/train_classifier.py

# 7. Start API
uvicorn app.main:app --reload

# 8. Frontend (new terminal)
cd ../frontend-react
npm install
npm run dev
```

Open `http://localhost:5173`

### Option B — Docker

```bash
cd backend
copy .env.example .env
docker-compose up --build
```

---

## Environment Variables

```env
# backend/.env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/tickets
MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
CLASSIFIER_MODEL=Dragneel/ticket-classification-v1
ZERO_SHOT_MODEL=facebook/bart-large-mnli
CONFIDENCE_THRESHOLD=0.92
ENVIRONMENT=development
DEBUG=true
SECRET_KEY=change-me-use-openssl-rand-hex-32
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
FAISS_INDEX_PATH=data/faiss.index
FAISS_META_PATH=data/faiss_meta.json
RATE_LIMIT_PER_MINUTE=60
```

---

## Training Your Classifier

```bash
cd backend
python scripts/train_classifier.py
```

Output:
```
[1/5] Loading training data...  95 samples
[2/5] Labels encoded: Billing Question, Feature Request, General Inquiry, Technical Issue
[3/5] Loading base model: distilbert-base-uncased
[4/5] Training on CPU...
[5/5] Evaluating...
Overall Accuracy: 94.74%
Model saved to: models/ticket_classifier/
```

The API loads YOUR model automatically on next start.

---

## Admin Access

Register normally, then run once in psql:

```sql
UPDATE users SET role = 'admin' WHERE username = 'your_username';
```

Admin portal gives access to: user management, role assignment, system stats, FAISS reindex.

---

## Running Tests

```bash
cd backend
venv\Scripts\activate
pytest tests/ -v
```

---

## Seeding Data

```bash
# Load 20 real-world tickets from CSV
python scripts/seed.py

# Run batch simulation (50 random tickets)
python scripts/batch_simulate.py --count 50
```

---

## Voice Assistant

Requires ffmpeg:

```bash
winget install ffmpeg
```

Speak naturally — the system extracts fields automatically:
- *"Critical — production server is down, users cannot login"* → P1, Technical Issue
- *"I was charged twice on my invoice this month"* → P2, Billing Question
- *"VIP client cannot access premium account after renewal"* → P2, VIP, HIGH risk

---

## What I Learned

- Building a RAG pipeline from scratch using FAISS and sentence transformers
- Fine-tuning DistilBERT on a custom labeled dataset without a GPU
- Designing a multi-factor confidence scoring system with full explainability
- JWT authentication with role-based access control in FastAPI
- Structuring a FastAPI project for production (services, routes, workers, schemas)
- Integrating Whisper for offline voice transcription
- Building a component-based React dashboard with real-time polling

---

## Future Improvements

- [ ] Persist FAISS index to S3 for multi-instance deployments
- [ ] Replace mock historical success rate with real DB-computed value
- [ ] Add Celery + Redis for distributed async task processing
- [ ] Train on larger domain-specific dataset for higher accuracy
- [ ] Add unit and integration test coverage to 80%+
- [ ] CI/CD pipeline with GitHub Actions
- [ ] Kubernetes deployment manifests

---

*Made by a student learning applied AI engineering.*
