# ResolvAI — Confidence-Governed AI Ticket Resolution System

A production-grade support ticket triage system built from scratch. Uses RAG-based similarity search, a fine-tuned DistilBERT classifier, multi-factor confidence scoring, Whisper voice transcription, and Groq-powered real-time AI chat to automatically classify, route, and resolve support tickets — with full explainability at every step.

Built with FastAPI, PostgreSQL, FAISS, Sentence Transformers, Whisper, Groq (llama-3.3-70b), Gemini, and React + Vite.

---

## System Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend — React + Vite"]
        CP[Customer Portal\nRaise · My Tickets · FAQ · Chat]
        AP[Admin Portal\nDashboard · Tickets · Voice · Audit · Metrics]
    end

    subgraph API["Backend — FastAPI"]
        AUTH["/auth\nJWT + bcrypt"]
        TR["/tickets\nCRUD + AI pipeline"]
        CR["/ws/chat\nWebSocket + Groq"]
        VR["/voice\nWhisper + PyAV"]
        FR["/faq\nSearch + CRUD"]
        MR["/metrics\nCached aggregates"]
        AR["/admin\nUser + system mgmt"]
    end

    subgraph AI["AI Stack"]
        EMB["all-MiniLM-L6-v2\n384-dim embeddings\nLRU cached"]
        FAISS["FAISS IndexFlatIP\nThread-safe RAG\nDisk-persisted"]
        CLF["DistilBERT\nFine-tuned classifier\n4 categories"]
        ZS["BART-large-mnli\nZero-shot fallback\n+ voice category"]
        CONF["Confidence Engine\nWeighted formula"]
        RISK["Risk Engine\nPriority + user type"]
        DEC["Decision Engine\nAUTO_RESOLVE / SUGGEST / ESCALATE"]
        WHISPER["Whisper tiny\nPyAV decoder\nNo ffmpeg needed"]
        GROQ["Groq llama-3.3-70b\n~0.5s responses\nFull ticket context"]
        GEMINI["Gemini 2.0 Flash\nFallback AI\nExplanations"]
    end

    subgraph DB["PostgreSQL"]
        T[(tickets)]
        P[(predictions)]
        AL[(audit_logs)]
        U[(users)]
        CM[(chat_messages)]
        FQ[(faqs)]
    end

    CP --> TR; CP --> CR; CP --> FR; CP --> AUTH
    AP --> TR; AP --> MR; AP --> AR; AP --> VR; AP --> AUTH

    TR --> EMB; TR --> FAISS; TR --> CLF; TR --> ZS
    TR --> CONF; TR --> RISK; TR --> DEC
    VR --> WHISPER; VR --> ZS
    CR --> GROQ; CR --> GEMINI

    EMB --> FAISS
    FAISS --> CONF; CLF --> CONF; RISK --> CONF
    CONF --> DEC

    TR --> DB; CR --> DB; AR --> DB; MR --> DB; FR --> DB
```

---

## AI Pipeline Flow

```mermaid
flowchart LR
    A([Ticket Input]) --> B["Generate Embedding\nall-MiniLM-L6-v2\nLRU cached"]
    B --> C{FAISS Index\nEmpty?}
    C -- No --> D["Search Top-3\nSimilar Tickets\nThread-safe lock"]
    C -- Yes --> E[similarity = 0]
    D --> F[Avg Cosine\nSimilarity Score]
    E --> F

    A --> G["DistilBERT Classifier\nFine-tuned on 95 samples\nFallback: BART zero-shot"]
    G --> H["classification_prob\n= score × resolvability"]

    A --> I["BART Zero-Shot\nFinancial Domain\nCategory"]

    A --> J["Risk Engine\nP1 or VIP → HIGH\nP2/P3 STANDARD → LOW"]
    J --> K["risk_adjustment\nLOW=0.2  HIGH=0.0"]

    F --> L["Confidence Formula\n0.35×cls + 0.35×sim\n+ 0.20×hist + 0.10×risk"]
    H --> L
    K --> L

    L --> M{Threshold\nCheck}
    M -->|"≥0.92 AND LOW risk"| N([AUTO_RESOLVE])
    M -->|"≥0.60"| O([SUGGEST])
    M -->|"< 0.60 OR HIGH risk"| P([ESCALATE])

    N --> Q["Persist to DB\nPrediction + Audit Log\nFAISS index update"]
    O --> Q
    P --> Q

    Q --> R["Groq llama-3.3-70b\nGenerate explanation\n~0.5s"]
```

---

## Confidence Formula

```mermaid
graph LR
    A["classification_prob × 0.35\nDistilBERT score × resolvability"] --> E["Confidence Score\nmin/max clamped 0–1"]
    B["similarity_score × 0.35\nAvg FAISS cosine similarity"] --> E
    C["historical_success × 0.20\nFixed at 0.80 baseline"] --> E
    D["risk_adjustment × 0.10\nLOW=0.2  HIGH=0.0"] --> E
    E --> F{"≥ 0.92 AND LOW risk?"}
    F -->|Yes| G["AUTO_RESOLVE\nApology + 3 action steps"]
    F -->|"≥ 0.60"| H["SUGGEST\nAgent review queued"]
    F -->|No| I["ESCALATE\nSenior team notified"]
```

---

## Voice Pipeline

```mermaid
sequenceDiagram
    participant U as Customer
    participant FE as React Frontend
    participant API as FastAPI
    participant W as Whisper tiny
    participant ZS as BART zero-shot
    participant AI as AI Pipeline
    participant DB as PostgreSQL

    U->>FE: Click mic button
    FE->>FE: MediaRecorder captures WebM/Opus
    U->>FE: Click stop
    FE->>FE: Blob MIME stripped to audio/webm
    FE->>API: POST /voice/transcribe
    API->>W: PyAV decodes WebM → float32 PCM 16kHz
    W-->>API: transcript text
    API->>ZS: classify category (zero-shot NLI)
    ZS-->>API: category + confidence score
    API->>API: keyword scoring → priority, user_type
    API->>API: smart title extraction (filler word removal)
    API-->>FE: transcript + extracted_fields
    FE->>FE: Auto-fill all form fields
    FE->>FE: Jump to step 2 if category detected
    U->>FE: Review, edit, submit
    FE->>API: POST /process-ticket
    API->>AI: run_pipeline(fields)
    AI-->>API: confidence, action, explanation
    API->>DB: ticket + prediction + audit_log
    API-->>FE: ProcessTicketResponse
    FE-->>U: Result panel + Continue with Chat CTA
```

---

## Groq AI Chat Flow

```mermaid
sequenceDiagram
    participant U as Customer
    participant FE as React Frontend
    participant WS as WebSocket /ws/chat
    participant API as FastAPI
    participant G as Groq llama-3.3-70b
    participant GM as Gemini 2.0 Flash
    participant DB as PostgreSQL

    U->>FE: Open Ticket Detail
    FE->>API: GET /tickets/{id}/prediction
    API-->>FE: full ticket context + AI decision
    FE->>WS: Connect with JWT token
    WS-->>FE: Connected (Live indicator)
    FE->>FE: Show quick reply suggestions
    U->>FE: Type message (or Ctrl+Enter)
    FE->>WS: send {message}
    WS->>DB: Persist customer message
    WS->>DB: Load last 8 chat messages
    WS->>G: system=ticket_ctx+history, user=message
    Note over G: llama-3.3-70b\n~0.5s response
    G-->>WS: contextual AI reply
    alt Groq rate limited
        WS->>GM: fallback to Gemini
        GM-->>WS: AI reply
    end
    WS->>DB: Persist AI message
    WS-->>FE: Broadcast both messages
    FE-->>U: Typing indicator → AI reply appears
```

---

## Duplicate Detection Flow

```mermaid
flowchart TD
    A([Customer submits ticket]) --> B["POST /tickets/check-duplicate\nGenerate embedding for new ticket"]
    B --> C["FAISS similarity search\ntop-3 nearest neighbours"]
    C --> D{"Any match\n≥ 0.92 cosine similarity?"}
    D -- Yes --> E["Return is_duplicate=true\nFollow Ticket #X message"]
    E --> F["Show duplicate banner in UI\nwith similarity % and title"]
    F --> G{Customer decision}
    G -- "Submit Anyway" --> H["POST /process-ticket\nFull AI pipeline"]
    G -- Cancel --> I([Discard])
    D -- No --> H
    H --> J["Ticket created\nResult panel shown"]
```

---

## Customer Portal Flow

```mermaid
flowchart TD
    A([Customer Login]) --> B{Input method}
    B -- Voice --> C["Record WebM audio\nLive waveform display"]
    C --> D["Whisper tiny transcribes\n~1-2s on CPU"]
    D --> E["BART zero-shot detects category\nKeyword scoring for priority"]
    E --> F["Auto-fill all fields\nJump to step 2"]
    B -- Manual --> G["Select category card\nStep 1"]
    G --> F
    F --> H["Fill details form\nStep 2 — inputs locked during submit"]
    H --> I["FAISS duplicate check\n< 100ms"]
    I --> J["POST /process-ticket\nFull AI pipeline ~2-3s"]
    J --> K["Result panel Step 3\nDecision + confidence + explanation"]
    K --> L["Groq explanation\n~0.5s"]
    K --> M["Continue with Chat CTA"]
    M --> N["Ticket Detail + WebSocket"]
    N --> O["Groq AI replies\nwith full ticket context\n~0.5s per message"]
    N --> P["Auto-reconnect\nif connection drops"]
```

---

## Database Schema

```mermaid
erDiagram
    users {
        int id PK
        string username UK
        string email UK
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

## API Reference

```mermaid
graph LR
    subgraph Auth
        A1[POST /auth/register\n5/min rate limit]
        A2[POST /auth/token\n10/min rate limit]
        A3[GET /auth/me]
    end

    subgraph Tickets
        T1[POST /process-ticket\nFull AI pipeline]
        T2[GET /tickets\nAdmin/agent only]
        T3[GET /my-tickets\nCustomer own tickets]
        T4[GET /tickets/:id/prediction\nFull AI result]
        T5[POST /tickets/check-duplicate\nFAISS similarity]
        T6[PATCH /tickets/:id/status\nAdmin/agent only]
        T7[POST /tickets/upload\nMIME validated 5MB]
        T8[GET /audit-logs]
    end

    subgraph Chat
        C1[GET /tickets/:id/chat\nHistory paginated]
        C2[POST /tickets/:id/chat\nREST fallback]
        C3[WS /ws/chat/:id\nGroq-powered real-time]
    end

    subgraph Voice
        V1[POST /voice/transcribe\n10/min · Whisper+BART]
        V2[POST /voice/process\n5/min · Full pipeline]
    end

    subgraph FAQ
        F1[GET /faq\nPublic · category filter]
        F2[GET /faq/search\nKeyword search]
        F3[POST /faq\nAdmin only]
    end

    subgraph Metrics
        M1[GET /metrics\n30s cached]
        M2[GET /metrics/detailed\nDistributions + FAISS]
        M3[GET /health\nPublic]
    end

    subgraph Admin
        AD1[GET /admin/users]
        AD2[PATCH /admin/users/:id\nRole + active toggle]
        AD3[GET /admin/system\nDB + AI stats]
        AD4[POST /admin/system/reindex\nRebuild FAISS]
        AD5[GET /admin/audit-logs\nDecision filter]
    end
```

---

## Project Structure

```
confidence-ai-ticket-system/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py          # Settings: DB, JWT, Groq, Gemini, FAISS
│   │   │   ├── security.py        # JWT encode/decode, bcrypt, role guards
│   │   │   └── exceptions.py      # Global error handlers + structured logging
│   │   ├── db/
│   │   │   ├── database.py        # SQLAlchemy engine (pool_size=20, recycle=3600)
│   │   │   └── models.py          # User, Ticket, Prediction, AuditLog, ChatMessage, FAQ
│   │   ├── routes/
│   │   │   ├── auth.py            # Register, login (rate limited), /me
│   │   │   ├── tickets.py         # CRUD, process, duplicate check, upload
│   │   │   ├── chat.py            # REST + WebSocket (Groq → Gemini → rule-based)
│   │   │   ├── faq.py             # CRUD + keyword search
│   │   │   ├── metrics.py         # Summary (30s cache) + detailed + health
│   │   │   ├── voice.py           # Transcribe + process (rate limited)
│   │   │   └── admin.py           # User mgmt + system controls
│   │   ├── services/
│   │   │   ├── ai_pipeline.py     # Orchestrates full 10-step AI flow
│   │   │   ├── ai_chat.py         # Groq primary → Gemini fallback → rule-based
│   │   │   ├── embeddings.py      # all-MiniLM-L6-v2 + LRU cache (512 entries)
│   │   │   ├── rag.py             # FAISS IndexFlatIP + threading.Lock + disk persist
│   │   │   ├── classifier.py      # DistilBERT fine-tuned + zero-shot fallback
│   │   │   ├── confidence.py      # Weighted formula: cls×0.35 + sim×0.35 + hist×0.20 + risk×0.10
│   │   │   ├── risk.py            # P1/VIP → HIGH, else LOW
│   │   │   ├── decision.py        # Threshold-based routing
│   │   │   └── voice.py           # Whisper tiny + PyAV + BART category detection
│   │   ├── schemas/               # Pydantic models for all routes
│   │   ├── utils/logger.py        # structlog structured logging
│   │   ├── workers/tasks.py       # Background: persist predictions, auto-escalate
│   │   └── main.py                # FastAPI app + GZip + CORS + rate limiting
│   ├── alembic/versions/
│   │   ├── 0001_initial_schema.py
│   │   ├── 0002_add_missing_columns.py  # status, category, chat_messages, faqs
│   │   └── 0003_add_indexes.py          # 7 performance indexes
│   ├── data/
│   │   ├── seed_tickets.csv       # 20 real-world support tickets
│   │   └── training_data.csv      # 95 labeled tickets for DistilBERT training
│   ├── models/
│   │   ├── ticket_classifier/     # Fine-tuned DistilBERT weights
│   │   └── label_map.json         # Category ID ↔ label mapping
│   ├── scripts/
│   │   ├── train_classifier.py    # Fine-tune DistilBERT on CPU (~10 min)
│   │   ├── seed_users.py          # Create admin/agent/customer test accounts
│   │   ├── seed_faq.py            # Seed FAQ entries via API
│   │   ├── seed.py                # Load CSV tickets via API
│   │   └── batch_simulate.py      # Generate N random tickets for testing
│   └── tests/                     # pytest test suite
│
└── frontend-react/
    └── src/
        ├── api/
        │   ├── client.js          # Axios + retry (2×, exp backoff) + 401 auto-logout
        │   ├── tickets.js         # Ticket + metrics endpoints
        │   ├── chat.js            # Chat + FAQ + my-tickets
        │   ├── voice.js           # Voice (MIME-stripped blob)
        │   └── admin.js           # Admin endpoints
        ├── components/
        │   ├── ErrorBoundary.jsx  # Catches JS crashes, shows friendly UI
        │   ├── CustomerNav.jsx    # Sticky top nav for customer portal
        │   ├── Sidebar.jsx        # Admin navigation with role-based items
        │   ├── ResultPanel.jsx    # Decision banner + Groq explanation + chat CTA
        │   ├── VoiceAssistant.jsx # Admin voice studio with waveform
        │   ├── Charts.jsx         # Donut + Line + Bar (Chart.js)
        │   └── ...                # MetricsRow, TicketForm, TicketLog, etc.
        ├── hooks/
        │   ├── useAuth.js         # JWT + /auth/me role fetch + stale token detection
        │   ├── useVoiceRecorder.js# MediaRecorder + Web Audio API analyser
        │   ├── useMetrics.js      # Polls /metrics every 10s
        │   └── useTicketLog.js    # Session ticket history
        └── pages/
            ├── customer/
            │   ├── RaiseTicketPage.jsx   # 3-step: category → details → result
            │   ├── MyTicketsPage.jsx     # Status stat cards + filter tabs
            │   ├── TicketDetailPage.jsx  # Info panel + Groq WebSocket chat
            │   └── FAQPage.jsx           # Debounced search + highlighted results
            ├── DashboardPage.jsx         # Live metrics + charts + ticket form
            ├── TicketsPage.jsx           # Table + inline status update
            ├── VoicePage.jsx             # Voice studio
            ├── AuditPage.jsx             # Audit log + decision filter
            ├── MetricsPage.jsx           # Detailed analytics
            └── AdminPage.jsx             # User mgmt + system stats + FAISS reindex
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| API | FastAPI 0.115 + Uvicorn | Async, auto OpenAPI docs |
| Database | PostgreSQL 15 + SQLAlchemy 2 | Pool size 20, 7 indexes |
| Migrations | Alembic | 3 migrations, safe re-run |
| Auth | JWT (python-jose) + bcrypt | Role-based access control |
| Embeddings | all-MiniLM-L6-v2 | 384-dim, LRU cached, ~24ms cold |
| Classifier | DistilBERT fine-tuned | 95 samples, 94.7% accuracy |
| Zero-Shot | facebook/bart-large-mnli | Fallback + voice category |
| Vector Search | FAISS IndexFlatIP | Thread-safe, disk-persisted |
| Voice | Whisper tiny + PyAV | No system ffmpeg, ~1-2s CPU |
| AI Chat | Groq llama-3.3-70b | ~0.5s, full ticket context |
| AI Fallback | Gemini 2.0 Flash | Rate limit fallback |
| Rate Limiting | slowapi | Auth + voice endpoints |
| Compression | GZipMiddleware | Responses > 1KB |
| Monitoring | Prometheus + structlog | /metrics-prom endpoint |
| Frontend | React 19 + Vite 8 | HMR, code splitting |
| Charts | Chart.js + react-chartjs-2 | Donut, line, bar |
| HTTP Client | Axios + retry interceptor | 2 retries, exp backoff |

---

## Quick Start

### Prerequisites
- Python 3.11+, Node.js 18+, PostgreSQL running locally

### Backend

```bash
cd backend

# Virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install
pip install -r requirements.txt

# Configure
copy .env.example .env
# Edit .env — set DATABASE_URL, GROQ_API_KEY, GEMINI_API_KEY

# Database
psql -U postgres -c "CREATE DATABASE tickets;"
python -m alembic upgrade head

# Seed
python scripts/seed_users.py

# (Optional) Train classifier — ~10 min on CPU
python scripts/train_classifier.py

# Run
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend-react
npm install
npm run dev
```

- Customer portal: http://localhost:5173/
- Admin portal: http://localhost:5173/?portal=admin

---

## Environment Variables

```env
# backend/.env
DATABASE_URL=postgresql://postgres:password@localhost:5432/tickets
SECRET_KEY=use-openssl-rand-hex-32-here
GROQ_API_KEY=your-groq-api-key          # https://console.groq.com
GEMINI_API_KEY=your-gemini-api-key      # https://aistudio.google.com
ENVIRONMENT=development
CONFIDENCE_THRESHOLD=0.92
RATE_LIMIT_PER_MINUTE=60
```

---

## Test Accounts

| Role | Username | Password | Portal |
|------|----------|----------|--------|
| Admin | `admin` | `admin123` | `/?portal=admin` |
| Agent | `agent1` | `agent123` | `/?portal=admin` |
| Customer | `customer1` | `customer123` | `/` |

Run `python scripts/seed_users.py` to create these.

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

Expected: ESCALATE · HIGH risk · ~75% confidence · Groq explanation in ~0.5s

---

## Performance Benchmarks

| Operation | Time |
|-----------|------|
| Embedding (cold) | ~24ms |
| Embedding (cached) | < 1ms |
| FAISS search (1k tickets) | < 5ms |
| Full AI pipeline | ~2-3s |
| Groq chat response | ~0.5-1.5s |
| Voice transcription (10s audio) | ~1-2s |
| Metrics endpoint (cached) | < 5ms |

---

## Training the Classifier

```bash
cd backend
python scripts/train_classifier.py
```

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

## Voice Input

No system ffmpeg required — PyAV handles all audio decoding natively.

Speak naturally — AI extracts all fields:
- *"Critical — production server is down, users cannot login"* → P1, Technical Issue, HIGH risk
- *"I was charged twice on my invoice this month"* → P2, Billing Question
- *"VIP client cannot access premium account after renewal"* → P2, VIP, Account Access

---

## What We Built

- **RAG pipeline from scratch** — FAISS + sentence transformers, thread-safe, disk-persisted
- **Fine-tuned DistilBERT** — trained on 95 custom support ticket samples, 94.7% accuracy
- **Multi-factor confidence scoring** — 4-component weighted formula with full explainability
- **Dual-portal React app** — customer and admin portals with role-based routing
- **Real-time AI chat** — WebSocket + Groq llama-3.3-70b, full ticket context injection
- **Voice-to-ticket pipeline** — Whisper + PyAV + BART zero-shot, no system dependencies
- **Production hardening** — DB connection pooling, FAISS thread locks, GZip, rate limiting, retry logic, error boundaries

---

## Future Improvements

- [ ] Email/SMS notifications on ticket status change
- [ ] Celery + Redis for distributed async task processing
- [ ] S3 for FAISS index and file attachment storage
- [ ] Train on larger domain-specific dataset (500+ samples)
- [ ] Cypress E2E test suite
- [ ] GitHub Actions CI/CD pipeline
- [ ] Kubernetes deployment manifests
- [ ] SLA tracking with breach alerts
