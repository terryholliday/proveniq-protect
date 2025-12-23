# PROVENIQ Protect

**The Shield — Algorithmic Risk MGA**

Dynamic insurance premiums powered by real-time asset truth from the PROVENIQ Ledger.

## Architecture

```
PROVENIQ Anchors → [Anchor Events] → Protect (Risk Adjustment)
                                          ↓
Home/Transit → [Quote Request] → Pricing Engine → Quote
                                          ↓
                              [Bind] → Policy → Claims
                                          ↓
                                    PROVENIQ Ledger
```

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** PostgreSQL + Prisma
- **Validation:** Zod
- **Port:** 3003 (frontend), DB: 5435

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with DATABASE_URL
npm run db:push
npm run dev
```

## API Endpoints

### Quotes
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/quote` | Get dynamic premium quote |

### Policies
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/policies/bind` | Bind quote to policy |
| `GET` | `/api/policies/[id]` | Get policy details |

### Claims
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/claims` | Submit a claim |
| `GET` | `/api/claims` | List claims (filter by policy_id, status) |
| `GET` | `/api/claims/[id]` | Get claim details |
| `PATCH` | `/api/claims/[id]` | Update claim (adjudication) |

### Anchor Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/anchors/events` | Webhook for anchor events |

## Pricing Engine

```
BASE_RATE = 10.00% (1000 BPS)

Discounts:
- VERIFIED_MAINTENANCE_RECENT: -1.50% (service < 90 days)
- CLEAN_TRANSIT_HISTORY: -0.50% (no damage)
- SECURITY_VERIFIED: -1.00%

Floor: 2.00% (200 BPS)
```

## Database Models

- **Quote** — Pricing snapshot before binding
- **Policy** — Active coverage
- **Claim** — Filed claims against policies
- **AnchorEvent** — Consumed anchor signals for risk
- **AuditLog** — All actions logged

## Anchor Risk Impact

| Event Type | Risk Impact |
|------------|-------------|
| `ANCHOR_SEAL_BROKEN` (TAMPER/FORCE) | CRITICAL → Claim trigger |
| `ANCHOR_SEAL_BROKEN` (other) | MAJOR |
| `ANCHOR_ENVIRONMENTAL_ALERT` (SHOCK) | MAJOR |
| `ANCHOR_ENVIRONMENTAL_ALERT` (other) | MINOR |
| `ANCHOR_CUSTODY_SIGNAL` | MINOR |
| `ANCHOR_SEAL_ARMED` | NONE (positive) |

## Environment Variables

```env
DATABASE_URL=postgresql://...
LEDGER_API_URL=http://localhost:8006/api/v1
ANCHORS_API_URL=http://localhost:8005/api/v1
USE_REAL_LEDGER=false
```

## License

Proprietary — PROVENIQ Inc.
