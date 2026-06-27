# EPC Guardian

> **AI Intelligence Platform for Data Centre EPC Project Delivery**
> ET AI Hackathon 2026 · Problem Statement 4

---

## The Problem

India's data centre capacity is growing from 900 MW to 2,700+ MW by 2027 — over ₹1,25,000 crore in capital deployment. A single hyperscale facility involves **15,000–40,000 equipment line items**, 200+ concurrent contractors, and thousands of commissioning test procedures.

Yet **67% of data centre EPC projects in Asia-Pacific experience schedule overruns exceeding 10%** (Turner & Townsend, 2024). The root cause: specification deviations are caught at the construction site instead of during procurement, because project knowledge is scattered across disconnected documents.

## The Solution

EPC Guardian reads project specifications and vendor submittals, **automatically detects technical deviations**, predicts the schedule impact, tracks equipment deliveries, manages commissioning readiness, and drafts corrective actions — all with cited evidence and human-in-the-loop governance.

```
🤖 AI extracts & explains  →  📊 Deterministic code decides  →  👷 Human approves  →  📝 Audit trail logged
```

---

## Quick Start

**Requirements:** Node.js 18+. No `npm install` needed — zero external dependencies.

```powershell
npm start
```

Open **http://localhost:4173**

---

## Key Results

| Metric | Value |
|---|---|
| Equipment scenarios analysed | **5** (UPS, Generator, CRAC, PDU, Fire suppression) |
| Documents indexed | **14** across specs, submittals, schedules, RFIs, risk registers |
| Retrieval accuracy | **100%** on 14-question expert-labelled benchmark |
| Automated tests | **22/22 passing** |
| Manual review time saved | **27.5 hours** (defensible methodology displayed in UI) |

---

## Compliance Scenarios

| Equipment | Requirement | Submitted | Rule | Result |
|---|---|---|---|---|
| UPS (VoltEdge VX900) | Efficiency ≥ 96.5% at 50% load | 95.2% | ≥ | ❌ Deviation |
| Generator (PowerCore G2500) | Sound level ≤ 85 dBA at 1m | 89 dBA | ≤ | ❌ Deviation |
| CRAC (ThermaFlow C150) | Sensible cooling ≥ 150 kW | 142 kW | ≥ | ❌ Deviation |
| PDU (GridLine PDU-400) | Input current == 400 A | 400 A | == | ✅ Compliant |
| Fire Suppression (SafeGas IG-541) | Discharge time ≤ 10 s | 8 s | ≤ | ✅ Compliant |

---

## Platform Features (8 Views)

| View | What It Does |
|---|---|
| **Overview** | Project dashboard — completion %, open deviations, documents indexed, hours saved, portfolio compliance cards |
| **Ask Project** | Natural language Q&A with cited evidence (document name, revision, page number). Hybrid keyword + embedding retrieval |
| **Compliance Review** | Side-by-side spec vs submittal comparison. Decision panel. AI extraction agent for new documents. Audit trail |
| **Schedule Impact** | Critical-path dependency timeline. What-if vendor response slider (1–14 days). Mitigation recommendations |
| **Commissioning** | Test readiness linked to compliance status. Prerequisites with blocked/ready indicators. Record templates |
| **Supply Chain** | Equipment delivery tracking with red/amber/green severity. Delivery variance. Alert sidebar |
| **Evidence Library** | All 14 indexed documents with type, revision, and status |
| **Validation** | Self-evaluation: 100% citation accuracy, 22/22 tests, 14-question benchmark results |

---

## AI/ML Architecture

### RAG Pipeline (Retrieval-Augmented Generation)

```
User question → Tokenize + Expand → Score all 28 document chunks
                                          ↓
                              ┌──── API key set? ────┐
                              │                      │
                         NO: Keyword              YES: Hybrid
                         scoring only          keyword + embeddings
                              │                      │
                              └──────────┬───────────┘
                                         ↓
                              Top 3 citations selected
                                         ↓
                              ┌──── API key set? ────┐
                              │                      │
                         NO: Raw text           YES: LLM writes
                         concatenation       grounded answer with
                                             [1] [2] [3] citations
```

### Structured Extraction Agent

The AI extraction agent reads free-text specifications and submittals, then fills a **JSON Schema** with structured fields (equipment type, field, operator, required value, submitted value, unit, confidence). The extracted data is then passed to deterministic code for compliance checking.

**With API key:** OpenAI structured JSON output → deterministic comparison
**Without API key:** Regex pattern matching → deterministic comparison

> **Key design decision:** AI never decides compliance. It extracts values. Then `95.2 >= 96.5` is plain math — 100% reproducible and auditable.

---

## Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js 18+ | Zero external dependencies — only built-in modules |
| Server | Native `node:http` | Lightweight, no framework overhead |
| Frontend | Vanilla HTML + CSS + JS | No build step, responsive design, instant deployment |
| AI/LLM | OpenAI Responses API | Structured extraction, grounded synthesis |
| Embeddings | text-embedding-3-small | 512-dimension semantic vectors for hybrid search |
| Testing | Native `node:test` | 22 automated tests across all modules |
| Data | JSON files | Synthetic EPC records — easily replaceable with DB connectors |

---

## Optional AI Mode

The application works **completely offline**. To enable hybrid retrieval, grounded synthesis, and structured extraction:

```powershell
$env:OPENAI_API_KEY="your-key"
npm start
```

When an API key is unavailable or a request fails, the app automatically falls back to keyword retrieval and local pattern-based extraction. The API key is server-side only and never sent to the browser.

---

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/project-analysis` | Full portfolio compliance analysis |
| GET | `/api/search?q=...` | RAG-powered document search |
| POST | `/api/ai-analyze` | AI extraction from new spec/submittal text |
| GET | `/api/schedule-prediction?responseDays=N` | What-if schedule forecast |
| GET | `/api/commissioning` | Test readiness assessment |
| POST | `/api/commissioning/tests` | Update test status |
| GET | `/api/supply-chain` | Delivery tracking and alerts |
| GET | `/api/documents` | Evidence library listing |
| GET | `/api/evaluation` | Retrieval benchmark results |
| GET | `/api/ai-health` | AI configuration status |
| GET | `/api/audit` | Decision audit trail |
| POST | `/api/reviews` | Human review decision |

---

## Testing

```powershell
npm run check          # Run all 22 automated tests
npm run verify:ai      # Verify AI integration (requires API key)
```

**Test coverage:** Compliance logic · AI extraction fallback · Document retrieval · Cosine similarity · Hybrid ranking · Schedule prediction · Commissioning blocking · Supply chain severity · Effort calculation

---

## Project Structure

```
├── server.js                      # HTTP server and API routing
├── public/
│   ├── index.html                 # 8-view responsive interface
│   ├── app.js                     # Frontend logic and rendering
│   └── styles.css                 # Design system
├── lib/
│   ├── analyze-project.js         # Deterministic compliance engine
│   ├── ai-agent.js                # AI structured extraction + local fallback
│   ├── openai-client.js           # OpenAI API communication
│   ├── search-documents.js        # Hybrid retrieval, RAG, and evaluation
│   ├── schedule-predictor.js      # What-if delay modeling
│   ├── commissioning.js           # Test readiness and prerequisites
│   ├── supply-chain.js            # Delivery tracking and alerts
│   └── effort-calculator.js       # Hours-saved methodology
├── data/
│   ├── project-data.json          # 5 equipment compliance scenarios
│   ├── document-corpus.json       # 14 documents, 28 searchable chunks
│   ├── evaluation-cases.json      # 14-question retrieval benchmark
│   ├── commissioning-standards.json  # Test procedures and prerequisites
│   └── supply-chain.json          # Equipment delivery tracking
├── test/                          # 22 automated tests
├── docs/                          # Architecture, pitch, and guides
└── outputs/                       # Submission deliverables
```

---

## Honest Prototype Boundaries

- All records are synthetic and contain no confidential project information.
- Embeddings are calculated on demand rather than persisted in a vector database.
- Schedule prediction is a transparent scenario model, not a trained model validated against historical projects.
- Supply-chain records are synthetic rather than live carrier feeds.
- The effort benchmark is an explicit assumption (4 min/page industry estimate), not a guaranteed saving.

---

## Submission Deliverables

- `outputs/epc-guardian-architecture.png` — Architecture diagram
- `outputs/epc-guardian-demo.mp4` — Demo video

