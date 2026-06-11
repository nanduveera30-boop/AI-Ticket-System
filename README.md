# Confidence-Governed AI Ticket Resolution System

A production-ready system that uses RAG, a locally trained DistilBERT classifier, and a multi-factor confidence engine to automatically triage and resolve support tickets — with full explainability, voice input, duplicate detection, Gemini AI chat, and dual customer/admin portals.
Built with FastAPI, PostgreSQL, FAISS, Sentence Transformers, Whisper, Gemini, and React + Vite.

---

## Live Demo Credentials

| Portal | URL | Username | Password | Role |
|--------|-----|----------|----------|------|
| Customer | `http://localhost:5173/` | `customer1` | `customer123` | customer |
| Admin | `http://localhost:5173/?portal=admin` | `admin` | `admin123` | admin |
| Agent | `http://localhost:5173/?portal=admin` | `agent1` | `agent123` | agent |

> Run `python scripts/seed_users.py` from the `backend/` folder to create these accounts.

---

## System Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend - React + Vite"]
        CP[Customer Portal\nRaise / My Tickets / FAQ / Chat]
        UI[Admin Dashboard\nTickets / Audit / Metrics]
        VA[Voice Assistant]
        AP[Admin Panel]
    end

    subgraph API["Backend - FastAPI"]
        AUTH[Auth Routes /auth]
        TR[Ticket Routes /tickets]
        VR[Voice Routes /voice]
        MR[Metrics Routes /metrics]
        AR[Admin Routes /admin]
        CR[Chat Routes /ws/chat]
        FR[FAQ Routes /faq]
    end

    subgraph AI["AI Pipeline"]
        EMB[Embeddings all-MiniLM-L6-v2]
        FAISS[FAISS Vector Store RAG]
        CLF[DistilBERT Classifier]
        ZS[Zero-Shot BART]
        CONF[Confidence Engine]
        RISK[Risk Engine]
        DEC[Decision Engine]
        WHISPER[Whisper Base Voice\nPyAV decoder]
        GEMINI[Gemini 2.0 Flash\nAI Chat + Explanations]
    end

    subgraph DB["PostgreSQL"]
        T[(tickets)]
        P[(predictions)]
        AL[(audit_logs)]
        U[(users)]
        CM[(chat_messages)]
        FQ[(faqs)]
    end

    CP --> TR
    CP --> CR
    CP --> FR
    UI --> TR
    UI --> MR
    VA --> VR
    AP --> AR
    Frontend --> AUTH

    TR --> AI
    VR --> WHISPER
    WHISPER --> TR
    CR --> GEMINI

    EMB --> FAISS
    FAISS --> CONF
    CLF --> CONF
    ZS --> CONF
    RISK --> CONF
    CONF --> DEC

    TR --> DB
    AR --> DB
    MR --> DB
    CR --> DB
    FR --> DB
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

    Q --> R[Gemini Explanation\nGenerated]
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
    participant NLP as Field Extractor
    participant AI as AI Pipeline
    participant DB as PostgreSQL

    U->>FE: Click Record
    FE->>FE: Capture audio (WebM/Opus via PyAV)
    U->>FE: Click Stop
    FE->>API: POST /voice/transcribe (audio blob)
    API->>W: transcribe_audio(bytes) via PyAV
    W-->>API: transcript text
    API->>NLP: extract_ticket_fields(transcript)
    Note over NLP: title, description, priority,\ncategory, user_type extracted\nvia keyword scoring
    API-->>FE: transcript + extracted_fields
    FE->>FE: Auto-fill form fields
    FE->>FE: Jump to step 2 if category detected
    U->>FE: Review & Submit
    FE->>API: POST /process-ticket
    API->>AI: run_pipeline(fields)
    AI-->>API: confidence, action, explanation
    API->>DB: persist ticket + prediction + audit_log
    API-->>FE: ProcessTicketResponse
    FE-->>U: Show result panel + Continue with Chat
```

---

## Gemini AI Chat Flow

```mermaid
sequenceDiagram
    participant U as Customer
    participant FE as Frontend
    participant WS as WebSocket
    participant API as FastAPI
    participant G as Gemini 2.0 Flash
    participant DB as PostgreSQL

    U->>FE: Open Ticket Detail
    FE->>API: GET /tickets/{id}/prediction
    API-->>FE: ticket context + AI decision
    FE->>WS: Connect /ws/chat/{id}?token=
    WS-->>FE: Connected (Live)
    U->>FE: Type message
    FE->>WS: send JSON {message}
    WS->>DB: Persist customer message
    WS->>DB: Load last 10 chat messages
    WS->>G: generate_ai_response(ticket_ctx, history, message)
    Note over G: Full context: title, description,\ncategory, priority, AI decision,\nconversation history
    G-->>WS: Contextual AI response
    WS->>DB: Persist AI message
    WS-->>FE: Broadcast both messages
    FE-->>U: Show typing indicator → AI reply
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

## Customer Portal Flow

```mermaid
flowchart TD
    A([Customer Login]) --> B{Choose input method}
    B -- Voice --> C[Record Audio]
    C --> D[Whisper Transcribes]
    D --> E[AI Extracts Fields\ntitle/desc/priority/category]
    E --> F[Auto-fill Form\nJump to Step 2]
    B -- Manual --> G[Select Category\nStep 1]
    G --> F
    F --> H[Fill Details\nStep 2]
    H --> I[Duplicate Check\nFAISS]
    I --> J[Submit Ticket\nAI Pipeline]
    J --> K[Result Panel\nStep 3]
    K --> L[AI Explanation\nGemini]
    K --> M[Continue with Chat]
    M --> N[Ticket Detail + WebSocket Chat]
    N --> O[Gemini AI replies\nwith full ticket context]
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
        string full_name
        bool is_active
        datetime created_at
    }

    tickets {
        int id PK
        string title
        string description
        string priority
        string category
        string user_type
        string status
        int customer_id FK
        int assigned_to FK
        string attachment_url
        datetime created_at
        datetime updated_at
    }

    predictions {
        int id PK
        int ticket_id FK
        float confidence
        string risk
        string action
        string ticket_category
        string financial_category
        text ai_explanation
        text apology_message
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

    chat_messages {
        int id PK
        int ticket_id FK
        int sender_id FK
        string sender_role
        text message
        bool is_ai
        datetime created_at
    }

    faqs {
        int id PK
        string question
        text answer
        string category
        bool is_active
        int view_count
        datetime created_at
    }

    tickets ||--o{ predictions : "has"
    tickets ||--o{ audit_logs : "has"
    tickets ||--o{ chat_messages : "has"
    users ||--o{ tickets : "raises"
    users ||--o{ chat_messages : "sends"
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
        T8[GET /my-tickets]
        T9[PATCH /tickets/:id/status]
        T10[POST /tickets/upload]
    end

    subgraph Chat
        C1[GET /tickets/:id/chat]
        C2[POST /tickets/:id/chat]
        C3[WS /ws/chat/:id]
    end

    subgraph Voice
        V1[POST /voice/transcribe]
        V2[POST /voice/process]
    end

    subgraph FAQ
        F1[GET /faq]
        F2[GET /faq/search]
        F3[GET /faq/:id]
        F4[POST /faq]
        F5[PATCH /faq/:id]
    end

    subgraph Metrics
        M1[GET /metrics]
        M2[GET /metrics/detailed]
        M3[GET /health]
    end

    subgraph Admin
        AD1[GET /admin/users]
        AD2[PATCH /admin/users/:id]
        AD3[DELETE /admin/users/:id]
        AD4[GET /admin/system]
        AD5[POST /admin/system/reindex]
        AD6[GET /admin/audit-logs]
    end
```

---

## Project Structure

```
confidence-ai-ticket-system/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py              # Settings from .env (+ GEMINI_API_KEY)
│   │   │   ├── security.py            # JWT + bcrypt auth
│   │   │   └── exceptions.py          # Global error handlers
│   │   ├── db/
│   │   │   ├── database.py            # SQLAlchemy engine + session
│   │   │   └── models.py              # User, Ticket, Prediction, AuditLog,
│   │   │                              # ChatMessage, FAQ
│   │   ├── routes/
│   │   │   ├── auth.py                # Register, login, /me
│   │   │   ├── tickets.py             # CRUD + process + duplicate check
│   │   │   ├── chat.py                # REST + WebSocket chat (Gemini)
│   │   │   ├── faq.py                 # FAQ CRUD + search
│   │   │   ├── metrics.py             # Summary + detailed + health
│   │   │   ├── voice.py               # Transcribe + voice process
│   │   │   └── admin.py               # User mgmt + system controls
│   │   ├── services/
│   │   │   ├── ai_pipeline.py         # Orchestrates full AI flow
│   │   │   ├── ai_chat.py             # Gemini chat + explanation service
│   │   │   ├── embeddings.py          # all-MiniLM-L6-v2 (loaded once)
│   │   │   ├── rag.py                 # FAISS with disk persistence
│   │   │   ├── classifier.py          # DistilBERT model
│   │   │   ├── confidence.py          # Weighted confidence formula
│   │   │   ├── risk.py                # Rule-based risk engine
│   │   │   ├── decision.py            # AUTO_RESOLVE / SUGGEST / ESCALATE
│   │   │   └── voice.py               # Whisper + PyAV + field extraction
│   │   ├── schemas/
│   │   │   ├── ticket.py              # Pydantic request/response models
│   │   │   ├── chat.py                # Chat message schemas
│   │   │   ├── faq.py                 # FAQ schemas
│   │   │   └── auth.py                # User schemas
│   │   ├── utils/
│   │   │   └── logger.py              # Structured logging (structlog)
│   │   ├── workers/
│   │   │   └── tasks.py               # Background persistence + auto-escalate
│   │   └── main.py                    # FastAPI app, middleware, routers
│   ├── alembic/
│   │   └── versions/
│   │       ├── 0001_initial_schema.py
│   │       └── 0002_add_missing_columns.py  # NEW: status, category, chat, faq
│   ├── data/
│   │   ├── seed_tickets.csv           # 20 real-world support tickets
│   │   └── training_data.csv          # 95 labeled tickets for training
│   ├── models/
│   │   ├── ticket_classifier/         # Trained DistilBERT (after training)
│   │   └── label_map.json             # Category ID → label mapping
│   ├── scripts/
│   │   ├── train_classifier.py        # Train model on CPU
│   │   ├── seed.py                    # Load CSV → API
│   │   ├── seed_users.py              # NEW: Create admin/agent/customer accounts
│   │   ├── seed_faq.py                # NEW: Seed FAQ entries
│   │   ├── batch_simulate.py          # Generate N random tickets
│   │   └── test_chat.py               # NEW: Test Gemini chat end-to-end
│   ├── tests/
│   │   ├── conftest.py
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
│   │   │   ├── client.js              # Axios instance
│   │   │   ├── tickets.js             # Ticket + metrics API calls
│   │   │   ├── chat.js                # NEW: Chat + FAQ + my-tickets API
│   │   │   ├── voice.js               # Voice API (PyAV blob handling)
│   │   │   └── admin.js               # Admin API calls
│   │   ├── components/
│   │   │   ├── Sidebar.jsx            # Admin navigation
│   │   │   ├── Topbar.jsx             # Page title + API status
│   │   │   ├── CustomerNav.jsx        # NEW: Customer portal nav bar
│   │   │   ├── LoginForm.jsx          # Auth screen (customer + admin)
│   │   │   ├── MetricsRow.jsx         # 5 stat cards
│   │   │   ├── Charts.jsx             # Donut + Line + Bar charts
│   │   │   ├── TicketForm.jsx         # Admin ticket form
│   │   │   ├── ResultPanel.jsx        # Confidence + Gemini explanation + CTA
│   │   │   ├── TicketLog.jsx          # Live session log table
│   │   │   ├── VoiceAssistant.jsx     # Admin voice studio
│   │   │   └── VoiceWaveform.jsx      # Real-time audio visualizer
│   │   ├── hooks/
│   │   │   ├── useAuth.js             # JWT auth + /auth/me role fetch
│   │   │   ├── useMetrics.js          # Polls /metrics every 10s
│   │   │   ├── useTicketLog.js        # Session ticket history
│   │   │   └── useVoiceRecorder.js    # MediaRecorder + Web Audio API
│   │   ├── pages/
│   │   │   ├── customer/              # NEW: Full customer portal
│   │   │   │   ├── RaiseTicketPage.jsx    # 3-step: category→details→result
│   │   │   │   ├── MyTicketsPage.jsx      # Ticket list with status filters
│   │   │   │   ├── TicketDetailPage.jsx   # Ticket info + Gemini WebSocket chat
│   │   │   │   └── FAQPage.jsx            # Search + accordion FAQ
│   │   │   ├── DashboardPage.jsx      # Metrics + charts + form + log
│   │   │   ├── TicketsPage.jsx        # Paginated ticket list + status update
│   │   │   ├── VoicePage.jsx          # Voice assistant page
│   │   │   ├── AuditPage.jsx          # Audit log + decision filter
│   │   │   ├── MetricsPage.jsx        # Detailed metrics + charts
│   │   │   └── AdminPage.jsx          # User management + system controls
│   │   ├── utils/
│   │   │   └── constants.js           # Batch tickets, color maps
│   │   ├── App.jsx                    # Role-based portal routing
│   │   ├── index.css                  # Admin portal styles
│   │   └── customer.css               # NEW: Customer portal styles
│   ├── .env.example
│   ├── vite.config.js
│   └── package.json
├── .gitignore
└── README.md
```

---

## What's New (v2)

### Customer Portal
- Full customer-facing portal at `http://localhost:5173/`
- 3-step ticket submission: category selection → details form → AI result
- Voice input with live waveform — Whisper transcribes, AI auto-fills all fields
- Duplicate detection with "Submit Anyway" option
- Result panel with Gemini-generated explanation and "Continue with Chat" CTA
- My Tickets page with status stat cards and filter tabs
- Ticket Detail page with real-time WebSocket chat

### Gemini AI Chat
- Powered by `gemini-2.0-flash-lite` (tries multiple models on rate limit)
- Full ticket context injected: title, description, category, priority, AI decision
- Last 10 messages of conversation history for coherent multi-turn chat
- Typing indicator while AI generates response
- Smart rule-based fallback when Gemini is rate limited

### Voice Improvements
- PyAV decoder — no system ffmpeg required on Windows
- Smarter field extraction: category detection via keyword scoring across 5 categories
- Priority scoring: P1 keywords (urgent/critical) > P2 (broken/error) > P3 (question)
- Auto-jumps to step 2 when category is detected from voice

### Backend Additions
- `chat.py` route — REST + WebSocket with Gemini integration
- `faq.py` route — CRUD + keyword search
- `ai_chat.py` service — Gemini client with multi-model fallback
- Migration `0002` — adds status, category, customer_id, chat_messages, faqs tables
- `seed_users.py` — creates admin/agent/customer test accounts
- Ticket status update endpoint (`PATCH /tickets/{id}/status`)
- Full prediction response includes `ticket_category`, `financial_category`, `ai_explanation`

### Portal Routing Fix
- Role-based routing (no URL dependency) — admin/agent always get admin shell
- Customer portal at `/`, admin portal at `/?portal=admin`
- Stale localStorage detection — forces re-login if role is missing

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | FastAPI 0.115 + Uvicorn |
| Database | PostgreSQL 15 + SQLAlchemy 2 |
| Migrations | Alembic |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 |
| Classifier | DistilBERT (your trained model) |
| Zero-Shot | facebook/bart-large-mnli |
| Vector Search | FAISS (persisted to disk) |
| Voice | OpenAI Whisper base (CPU) + PyAV |
| AI Chat | Google Gemini 2.0 Flash |
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
# Edit .env — set DATABASE_URL and GEMINI_API_KEY

# 5. Create database
psql -U postgres -c "CREATE DATABASE tickets;"

# 6. Run migrations
python -m alembic upgrade head

# 7. Seed users and FAQs
python scripts/seed_users.py

# 8. (Optional) Train YOUR classifier (~5-15 min on CPU)
python scripts/train_classifier.py

# 9. Start API
uvicorn app.main:app --reload --port 8000

# 10. Frontend (new terminal)
cd ../frontend-react
npm install
npm run dev
```

- Customer portal: http://localhost:5173/
- Admin portal: http://localhost:5173/?portal=admin

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
GEMINI_API_KEY=your-gemini-api-key-here
```

Get a free Gemini API key at: https://aistudio.google.com/

---

## Example Test Ticket

```
Category:    Technical Issue
Title:       WiFi not working in room A412
Description: My wifi has been completely down for 2 days. I cannot connect
             to the internet at all. The error shows "No internet, secured".
             I've tried restarting the router 3 times and reconnecting but
             nothing works. This is affecting my work.
Priority:    P2 — High
Account:     Standard
```

Expected: ESCALATE decision, HIGH risk, ~75% confidence, Gemini explanation generated

---

## Training Your Classifier

```bash
cd backend
python scripts/train_classifier.py
```

Output:
```
[1/5] Loading training data...  95 samples
[2/5] Labels: Billing Question, Feature Request, General Inquiry, Technical Issue
[3/5] Loading base model: distilbert-base-uncased
[4/5] Training on CPU...
[5/5] Evaluating...
Overall Accuracy: 94.74%
Model saved to: models/ticket_classifier/
```

---

## Voice Assistant

No system ffmpeg required — PyAV handles all audio decoding natively.

Speak naturally — AI extracts fields automatically:
- *"Critical — production server is down, users cannot login"* → P1, Technical Issue
- *"I was charged twice on my invoice this month"* → P2, Billing Question
- *"VIP client cannot access premium account after renewal"* → P2, VIP, HIGH risk

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
# Create test accounts
python scripts/seed_users.py

# Load 20 real-world tickets from CSV
python scripts/seed.py

# Run batch simulation (50 random tickets)
python scripts/batch_simulate.py --count 50
```

---

## What I Learned

- Building a RAG pipeline from scratch using FAISS and sentence transformers
- Fine-tuning DistilBERT on a custom labeled dataset without a GPU
- Designing a multi-factor confidence scoring system with full explainability
- JWT authentication with role-based access control in FastAPI
- Structuring a FastAPI project for production (services, routes, workers, schemas)
- Integrating Whisper for offline voice transcription without system dependencies
- Building a dual-portal React app (customer + admin) with role-based routing
- Real-time WebSocket chat with Gemini AI context injection
- Handling audio decoding cross-platform with PyAV

---

## Future Improvements

- [ ] Persist FAISS index to S3 for multi-instance deployments
- [ ] Replace mock historical success rate with real DB-computed value
- [ ] Add Celery + Redis for distributed async task processing
- [ ] Train on larger domain-specific dataset for higher accuracy
- [ ] Add unit and integration test coverage to 80%+
- [ ] CI/CD pipeline with GitHub Actions
- [ ] Kubernetes deployment manifests
- [ ] Email notifications on ticket status change
- [ ] File attachment preview in ticket detail

---

*Made by a student learning applied AI engineering.*
