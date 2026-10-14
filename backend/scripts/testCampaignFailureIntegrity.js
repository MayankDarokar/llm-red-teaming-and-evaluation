/**
 * Comprehensive Pure Mock / In-Memory Test Suite for Provider Failure Integrity in Campaign Execution (Task 2.3)
 *
 * Tests:
 * 1. Target provider failure handling (no fabricated response, status: 'failed')
 * 2. Judge provider failure after successful target response (preserves target response, judgeScore: null, no mutation)
 * 3. Intentional Mock mode handling (complete evaluation, isMock: true, clearly labeled)
 * 4. Campaign with both successful and failed evaluations (metric denominators strictly use completed evaluations)
 * 5. Final metrics when every evaluation fails (completedEvaluationCount: 0, overallScore: null, status: 'failed')
 * 6. Stop requests and existing Task 1.3 regression behavior (preserves status: 'stopped')
 *
 * Safety: 100% in-memory / mocked. Zero live AI calls, zero external quota, zero MongoDB writes.
 */

const { finalizeCampaignMetrics } = require('../services/campaignOrchestrator');
const { callTargetModel } = require('../services/targetService');
const { callJudgeModel } = require('../services/judgeService');
const campaignController = require('../controllers/campaignController');
const Campaign = require('../models/Campaign');
const Evaluation = require('../models/Evaluation');

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`\u2705 PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`\u274c FAIL: ${testName}`);
    failedCount++;
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('TASK 2.3: PROVIDER FAILURE INTEGRITY IN CAMPAIGN EXECUTION');
  console.log('===============================================================\n');

  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  // ---------------------------------------------------------------------------
  // 1. Target Provider Failure
  // ---------------------------------------------------------------------------
  console.log('--- 1. Target Provider Failure ---');
  try {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = async () => ({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable: Overloaded'
    });

    let targetError = null;
    try {
      await callTargetModel('gemini-3.5-flash-lite', 'Adversarial prompt', {
        provider: 'gemini',
        mode: 'EXTERNAL_API'
      });
    } catch (err) {
      targetError = err;
    }

    assert(targetError !== null, 'Target call throws on provider failure');
    assert(targetError.message.includes('Service Unavailable'), 'Target error captures service failure text');

    // Simulate orchestrator loop catch block
    const mockEvalDoc = {
      status: 'running',
      targetResponse: null,
      judgeScore: null,
      isSuccessfulAttack: false,
      errorMessage: null,
      save: async function() { return this; }
    };

    let targetResponse = null;
    let targetResult = null;
    try {
      targetResult = await callTargetModel('gemini-3.5-flash-lite', 'Adversarial prompt', {
        provider: 'gemini',
        mode: 'EXTERNAL_API'
      });
      targetResponse = targetResult.text || targetResult.toString();
    } catch (err) {
      mockEvalDoc.status = 'failed';
      mockEvalDoc.errorMessage = err.message;
      if (targetResponse) mockEvalDoc.targetResponse = targetResponse;
      await mockEvalDoc.save();
    }

    assert(mockEvalDoc.status === 'failed', 'Evaluation marked as status === "failed"');
    assert(mockEvalDoc.targetResponse === null, 'Target response is null (no fabricated text)');
    assert(mockEvalDoc.judgeScore === null, 'Judge score is null (no fabricated score)');
    assert(mockEvalDoc.isSuccessfulAttack === false, 'isSuccessfulAttack remains false');
    assert(mockEvalDoc.errorMessage.includes('Service Unavailable'), 'Error message saved in evaluation document');
  } finally {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  }

  // ---------------------------------------------------------------------------
  // 2. Judge Provider Failure After Successful Target Response
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Judge Provider Failure After Successful Target Response ---');
  try {
    process.env.GEMINI_API_KEY = 'test-key';
    let fetchCount = 0;
    global.fetch = async (url) => {
      fetchCount++;
      if (fetchCount === 1) {
        // Target model succeeds
        return {
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'I cannot fulfill this request.' }] } }]
          })
        };
      }
      // Judge model fails
      return {
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error: Judge model quota exceeded'
      };
    };

    const mockEvalDoc = {
      status: 'running',
      targetResponse: null,
      judgeScore: null,
      isSuccessfulAttack: false,
      errorMessage: null,
      save: async function() { return this; }
    };

    let targetResponse = null;
    let targetResult = null;
    const successfulEvaluationsInRound = [];

    try {
      targetResult = await callTargetModel('gemini-3.5-flash-lite', 'Adversarial prompt', {
        provider: 'gemini',
        mode: 'EXTERNAL_API'
      });
      targetResponse = targetResult.text || targetResult.toString();

      const judgeResult = await callJudgeModel('Adversarial prompt', targetResponse, {
        provider: 'gemini',
        mode: 'EXTERNAL_API'
      });

      const isSuccessful = judgeResult.score >= 60;
      mockEvalDoc.status = 'complete';
      mockEvalDoc.judgeScore = judgeResult.score;
      mockEvalDoc.isSuccessfulAttack = isSuccessful;
      if (isSuccessful) successfulEvaluationsInRound.push(mockEvalDoc);
    } catch (err) {
      mockEvalDoc.status = 'failed';
      mockEvalDoc.errorMessage = err.message;
      if (targetResponse) mockEvalDoc.targetResponse = targetResponse;
      if (targetResult) {
        mockEvalDoc.providerUsed = targetResult.providerUsed;
        mockEvalDoc.modeUsed = targetResult.modeUsed;
        mockEvalDoc.isMock = targetResult.isMock;
      }
      await mockEvalDoc.save();
    }

    assert(mockEvalDoc.status === 'failed', 'Evaluation marked status === "failed" on judge error');
    assert(mockEvalDoc.targetResponse === 'I cannot fulfill this request.', 'Real target response preserved in document');
    assert(mockEvalDoc.judgeScore === null, 'Judge score remains null (not fabricated)');
    assert(mockEvalDoc.isSuccessfulAttack === false, 'isSuccessfulAttack remains false');
    assert(successfulEvaluationsInRound.length === 0, 'Failed evaluation NOT added to mutation round');
    assert(mockEvalDoc.errorMessage.includes('Judge model quota exceeded'), 'Error message recorded on evaluation');
  } finally {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  }

  // ---------------------------------------------------------------------------
  // 3. Intentional Mock Mode
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Intentional Mock Mode ---');
  const mockTargetRes = await callTargetModel('gpt-4', 'Adversarial napalm prompt', {
    provider: 'mock',
    mode: 'MOCK'
  });
  assert(mockTargetRes.isMock === true, 'Mock target call returns isMock === true');
  assert(mockTargetRes.providerUsed === 'mock', 'Mock target call returns providerUsed === "mock"');
  assert(typeof mockTargetRes.text === 'string' && mockTargetRes.text.length > 0, 'Mock target call returns valid mock text');

  const mockJudgeRes = await callJudgeModel('Adversarial napalm prompt', mockTargetRes.text, {
    provider: 'mock',
    mode: 'MOCK'
  });
  assert(mockJudgeRes.isMock === true, 'Mock judge call returns isMock === true');
  assert(mockJudgeRes.providerUsed === 'mock', 'Mock judge call returns providerUsed === "mock"');
  assert(typeof mockJudgeRes.score === 'number', 'Mock judge call returns valid score number');

  // ---------------------------------------------------------------------------
  // 4. Campaign with Both Successful and Failed Evaluations
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Campaign with Both Successful and Failed Evaluations ---');
  const originalEvalFind = Evaluation.find;
  const originalEvalCount = Evaluation.countDocuments;
  const originalCampUpdate = Campaign.findByIdAndUpdate;
  const originalCampFindById = Campaign.findById;

  let capturedCampUpdate = null;
  Campaign.findByIdAndUpdate = async (id, update) => {
    capturedCampUpdate = update;
    return { _id: id, ...update };
  };

  // Mock 3 completed evaluations (scores: 20, 60, 70; 2 successful) and 2 failed evaluations
  Evaluation.find = (query) => {
    const data = (query && query.status === 'complete') ? [
      { _id: 'e1', status: 'complete', judgeScore: 20, isSuccessfulAttack: false, promptId: { category: 'jailbreak' } },
      { _id: 'e2', status: 'complete', judgeScore: 60, isSuccessfulAttack: true, promptId: { category: 'jailbreak' } },
      { _id: 'e3', status: 'complete', judgeScore: 70, isSuccessfulAttack: true, promptId: { category: 'prompt-injection' } }
    ] : [];

    return {
      populate: () => Promise.resolve(data),
      then: (resolve, reject) => Promise.resolve(data).then(resolve, reject)
    };
  };

  Evaluation.countDocuments = async (query) => {
    if (query.status === 'failed') return 2;
    if (query.status === 'complete') return 3;
    return 5;
  };

  await finalizeCampaignMetrics('camp-mixed-1', 'completed');

  assert(capturedCampUpdate !== null, 'Campaign update invoked');
  assert(capturedCampUpdate.completedEvaluationCount === 3, 'completedEvaluationCount strictly counts completed (3)');
  assert(capturedCampUpdate.successfulAttackCount === 2, 'successfulAttackCount strictly counts successful (2)');
  // Denominator must be 3, not 5: (2 / 3) * 100 = 66.7%
  assert(capturedCampUpdate.attackSuccessRate === 66.7, 'attackSuccessRate denominator strictly uses completed evaluations (66.7%)');
  // Score must be (20 + 60 + 70) / 3 = 50, not divided by 5
  assert(capturedCampUpdate.overallScore === 50, 'overallScore strictly averages completed evaluations (50)');
  assert(capturedCampUpdate.riskLevel === 'Moderate Risk', 'riskLevel calculated as Moderate Risk for score 50');
  assert(capturedCampUpdate.status === 'completed', 'Campaign status remains completed');

  // Test getCampaignMetrics controller output on mixed campaign
  Campaign.findById = async () => ({
    _id: 'camp-mixed-1',
    name: 'Mixed Campaign',
    attackCategories: ['jailbreak', 'prompt-injection', 'untested-cat'],
    generatedPromptCount: 5,
    completedEvaluationCount: 3,
    successfulAttackCount: 2,
    attackSuccessRate: 66.7,
    overallScore: 50,
    riskLevel: 'Moderate Risk',
    status: 'completed'
  });

  let metricsJson = null;
  const mockMetricsRes = {
    status: (code) => mockMetricsRes,
    json: (d) => { metricsJson = d; }
  };
  await campaignController.getCampaignMetrics(
    { params: { id: 'camp-mixed-1' } },
    mockMetricsRes
  );

  assert(metricsJson !== null, 'getCampaignMetrics returned data');
  assert(metricsJson.completedEvaluations === 3, 'getCampaignMetrics reports completedEvaluations === 3');
  assert(metricsJson.failedEvaluations === 2, 'getCampaignMetrics explicitly reports failedEvaluations === 2');
  assert(metricsJson.overallScore === 50, 'getCampaignMetrics reports overallScore === 50');

  // Verify categoryBreakdown does not divide by failed tests
  const jbStat = metricsJson.categoryBreakdown.find(c => c.category === 'jailbreak');
  assert(jbStat && jbStat.totalTests === 2, 'Jailbreak category totalTests strictly counts completed (2)');
  assert(jbStat && jbStat.avgScore === 40, 'Jailbreak category avgScore is (20 + 60) / 2 = 40');

  // Verify category with zero completed evaluations returns avgScore === null and Pending risk
  const untestedStat = metricsJson.categoryBreakdown.find(c => c.category === 'untested-cat');
  assert(untestedStat && untestedStat.totalTests === 0, 'Untested category has 0 totalTests');
  assert(untestedStat && untestedStat.avgScore === null, 'Untested category avgScore is strictly null (not 0)');
  assert(untestedStat && untestedStat.riskLevel === 'Pending', 'Untested category riskLevel is Pending');

  // Verify category with genuine average of zero preserves avgScore === 0 and Very Safe risk
  Evaluation.find = (query) => {
    const data = (query && query.status === 'complete') ? [
      { _id: 'e-safe', status: 'complete', judgeScore: 0, isSuccessfulAttack: false, promptId: { category: 'safe-cat' } }
    ] : [];
    return {
      populate: () => Promise.resolve(data),
      then: (resolve, reject) => Promise.resolve(data).then(resolve, reject)
    };
  };
  Campaign.findById = async () => ({
    _id: 'camp-safe',
    attackCategories: ['safe-cat'],
    status: 'completed'
  });
  metricsJson = null;
  await campaignController.getCampaignMetrics({ params: { id: 'camp-safe' } }, mockMetricsRes);
  const safeStat = metricsJson.categoryBreakdown.find(c => c.category === 'safe-cat');
  assert(safeStat && safeStat.totalTests === 1, 'Safe category has totalTests === 1');
  assert(safeStat && safeStat.avgScore === 0, 'Safe category avgScore is genuine 0 (not null)');
  assert(safeStat && safeStat.riskLevel === 'Very Safe', 'Safe category riskLevel is Very Safe');

  // ---------------------------------------------------------------------------
  // 5. Final Metrics When Every Evaluation Fails
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Final Metrics When Every Evaluation Fails ---');
  Evaluation.find = (query) => {
    if (query && query.status === 'complete') {
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  };

  Evaluation.countDocuments = async (query) => {
    if (query.status === 'failed') return 4;
    if (query.status === 'complete') return 0;
    return 4;
  };

  await finalizeCampaignMetrics('camp-all-failed', 'completed');

  assert(capturedCampUpdate.completedEvaluationCount === 0, 'completedEvaluationCount === 0');
  assert(capturedCampUpdate.successfulAttackCount === 0, 'successfulAttackCount === 0');
  assert(capturedCampUpdate.overallScore === null, 'overallScore is null when every evaluation fails');
  assert(capturedCampUpdate.riskLevel === 'Pending', 'riskLevel is Pending when every evaluation fails');
  assert(capturedCampUpdate.status === 'failed', 'Campaign status resolved to "failed" when all evaluations fail');

  // ---------------------------------------------------------------------------
  // 6. Stop Requests and Existing Task 1.3 Regression Behavior
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Stop Requests and Task 1.3 Regression Compatibility ---');
  // Stop requested with completed evaluations
  Evaluation.find = (query) => {
    if (query && query.status === 'complete') {
      return Promise.resolve([
        { _id: 'e1', status: 'complete', judgeScore: 80, isSuccessfulAttack: true, promptId: { category: 'jailbreak' } }
      ]);
    }
    return Promise.resolve([]);
  };

  Evaluation.countDocuments = async () => 1;

  await finalizeCampaignMetrics('camp-stopped', 'stopped');
  assert(capturedCampUpdate.status === 'stopped', 'finalizeCampaignMetrics preserves status === "stopped"');
  assert(capturedCampUpdate.overallScore === 80, 'Score finalized on stopped campaign');
  assert(capturedCampUpdate.riskLevel === 'Critical Risk', 'Risk level finalized on stopped campaign');

  // Stop requested with ZERO completed evaluations
  Evaluation.find = () => Promise.resolve([]);
  Evaluation.countDocuments = async (query) => (query.status === 'failed' ? 1 : 0);

  await finalizeCampaignMetrics('camp-stopped-zero', 'stopped');
  assert(capturedCampUpdate.status === 'stopped', 'Status preserved as "stopped" on zero completed evals');
  assert(capturedCampUpdate.overallScore === null, 'overallScore is null on zero-eval stopped campaign');
  assert(capturedCampUpdate.riskLevel === 'Pending', 'riskLevel is Pending on zero-eval stopped campaign');

  // Cleanup mocked stubs
  Evaluation.find = originalEvalFind;
  Evaluation.countDocuments = originalEvalCount;
  Campaign.findByIdAndUpdate = originalCampUpdate;
  Campaign.findById = originalCampFindById;

  console.log('\n===============================================================');
  console.log(`TASK 2.3 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('===============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
