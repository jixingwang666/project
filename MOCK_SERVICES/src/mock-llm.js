const express = require('express');
const { normalizePlanRequest } = require('./contracts/planContract');
const { createMockPlanEngine } = require('./engines/mockPlanEngine');

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.MOCK_LLM_PORT || 3300);
const planEngine = createMockPlanEngine();

app.post('/mock/llm/plan', (req, res) => {
  try {
    const planRequest = normalizePlanRequest(req.body || {});
    const plan = planEngine.buildPlan(planRequest);
    res.status(200).json(plan);
  } catch (error) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: error.message
    });
  }
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'mock-llm' });
});

app.listen(PORT, () => {
  console.log(`[MockLLM] listening on http://127.0.0.1:${PORT}`);
});
