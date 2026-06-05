const express = require('express');
const { normalizeRunRequest, assertInitConfig } = require('./contracts/simulationContract');
const { createMockSimulationEngine } = require('./engines/mockSimulationEngine');

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.MOCK_BACKEND_PORT || 3200);
const MIDDLEWARE_BASE_URL = String(process.env.MIDDLEWARE_BASE_URL || 'http://127.0.0.1:3100').replace(/\/+$/, '');
const MIDDLEWARE_FRAME_INGEST_TOKEN = String(process.env.MIDDLEWARE_FRAME_INGEST_TOKEN || '');
const DEFAULT_FPS = Number(process.env.MOCK_FPS || 2);
const DEFAULT_TOTAL_FRAMES = Number(process.env.MOCK_TOTAL_FRAMES || 30);
const simulationEngine = createMockSimulationEngine({
  defaultFps: DEFAULT_FPS,
  defaultTotalFrames: DEFAULT_TOTAL_FRAMES
});

async function postFrame(simulationId, frame) {
  const headers = {
    'Content-Type': 'application/json',
    'x-request-id': `mock-backend-${Date.now()}-${frame.frameIndex}`
  };

  if (MIDDLEWARE_FRAME_INGEST_TOKEN) {
    headers['x-internal-token'] = MIDDLEWARE_FRAME_INGEST_TOKEN;
  }

  const response = await fetch(`${MIDDLEWARE_BASE_URL}/api/simulations/${encodeURIComponent(simulationId)}/frames`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ frames: [frame] })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`failed to push frame ${frame.frameIndex}, status=${response.status}, body=${errorBody}`);
  }
}

app.post('/mock/backend/run', async (req, res) => {
  try {
    const runRequest = normalizeRunRequest(req.body || {});
    const { simulationId, initConfig, options } = runRequest;
    assertInitConfig(initConfig);

    console.log(
      `[MockBackend] accepted simulationId=${simulationId}, scenarioId=${initConfig.scenarioId}, mapLevel=${initConfig.mapLevel}, fps=${options.fps}, totalFrames=${options.totalFrames}, randomMode=${options.randomMode}`
    );

    const accepted = await simulationEngine.runSimulation(runRequest, {
      onFrame(frame) {
        return postFrame(simulationId, frame);
      },
      onCompleted(summary) {
        console.log(`[MockBackend] simulation completed: simulationId=${summary.simulationId}, totalFrames=${summary.totalFrames}`);
      },
      onError(error) {
        console.error('[MockBackend] stream stopped:', error.message);
      }
    });

    res.status(200).json(accepted);
  } catch (error) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: error.message
    });
  }
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'mock-backend' });
});

app.listen(PORT, () => {
  console.log(`[MockBackend] listening on http://127.0.0.1:${PORT}`);
  console.log(`[MockBackend] target middleware: ${MIDDLEWARE_BASE_URL}`);
});
