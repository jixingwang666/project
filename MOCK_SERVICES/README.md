# Mock Services for Metro Simulation

This directory contains two standalone mock services:

1. Mock backend service
- Receives simulation start command from middleware.
- Validates payload shape.
- Generates preset/random `FrameSnapshot` frames.
- Pushes frames back to middleware via `POST /api/simulations/:simId/frames`.

2. Mock LLM service
- Receives plan generation request from middleware.
- Validates request fields.
- Returns a valid `PlanConfig` payload.

## Architecture (framework-ready)

To make migration to production services easier, mock services are split into stable layers:

- `src/contracts/`: request normalization and schema-level validation.
- `src/engines/`: pure business engines (`mockSimulationEngine`, `mockPlanEngine`).
- `src/mock-backend.js` / `src/mock-llm.js`: thin HTTP adapters only.

When replacing mock with production implementation, keep HTTP routes and contracts, then swap engine modules first.

## 1) Install

```powershell
cd MOCK_SERVICES
npm install
```

## 2) Run services

Run backend mock:

```powershell
npm run start:backend
```

Run llm mock in another terminal:

```powershell
npm run start:llm
```

## 3) Environment variables

### Mock backend (`src/mock-backend.js`)

- `MOCK_BACKEND_PORT` (default `3200`)
- `MIDDLEWARE_BASE_URL` (default `http://127.0.0.1:3100`)
- `MIDDLEWARE_FRAME_INGEST_TOKEN` (optional, used for `x-internal-token` when middleware enables frame write protection)
- `MOCK_FPS` (default `2`)
- `MOCK_TOTAL_FRAMES` (default `30`)

### Mock llm (`src/mock-llm.js`)

- `MOCK_LLM_PORT` (default `3300`)

## 4) Middleware side setup

Set these values in `PROJECT/MIDDLEWARE/server/.env`:

```env
SIM_ENGINE_BASE_URL=http://127.0.0.1:3200
SIM_ENGINE_PATH=/mock/backend/run
LLM_BASE_URL=http://127.0.0.1:3300
LLM_PLAN_PATH=/mock/llm/plan
EXTERNAL_HTTP_TIMEOUT_MS=15000

# Optional security guards (recommended for integration test/staging)
FRAME_INGEST_TOKEN=your_frame_token
INTEGRATION_API_TOKEN=your_integration_token
```

When `FRAME_INGEST_TOKEN` is enabled in middleware, also set the same value for mock backend:

```powershell
$env:MIDDLEWARE_FRAME_INGEST_TOKEN="your_frame_token"
```

When `INTEGRATION_API_TOKEN` is enabled in middleware, include `x-internal-token` in calls:

```http
POST /api/integration/backend/start
x-internal-token: your_integration_token
Content-Type: application/json
```

## 5) Trigger from middleware

1. Create simulation first (`POST /api/simulations`)
2. Trigger mock backend:

```http
POST /api/integration/backend/start
Content-Type: application/json

{
  "simulationId": "sim_xxx",
  "options": {
    "fps": 2,
    "totalFrames": 20,
    "randomMode": true
  }
}
```

3. Trigger mock llm plan generation:

```http
POST /api/integration/llm/plan
Content-Type: application/json

{
  "fromSimulationId": "sim_xxx",
  "fromSimTime": 10,
  "objective": "Increase evacuation speed and reduce smoke exposure"
}
```

## 6) UE communication test preparation

After middleware is started, run the middleware-side UE mock client to verify `UpdateFrame` / `SimState` / `ControlCamera` reception:

```powershell
cd PROJECT/MIDDLEWARE/server
$env:SIMULATION_ID="sim_xxx"
npm run start:mock-ue
```

This client subscribes with `clientRole=ue` and prints UE-side events for integration verification.
