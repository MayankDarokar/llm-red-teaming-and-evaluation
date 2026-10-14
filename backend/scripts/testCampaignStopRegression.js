/**
 * Regression Test Suite for Campaign Stop Metric Finalization (Task 1.3)
 * Tests:
 * 1. Stopping after at least one completed evaluation (metrics calculated, status remains 'stopped')
 * 2. Stopping with zero completed evaluations (overallScore is null, riskLevel is 'Pending', status remains 'stopped')
 * 3. Normal finalization retains 'completed' status
 * 4. Loop interruption when stopRequested is set
 * 
 * Safety:
 * - Uses isolated mock documents prefixed with '__REGRESSION_TEST_'
 * - No external AI API calls or quota consumption
 * - Cleans up only test documents in finally block
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const Evaluation = require('../models/Evaluation');
const Prompt = require('../models/Prompt');
const { finalizeCampaignMetrics, runCampaignOrchestrator } = require('../services/campaignOrchestrator');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/redteaming_db';

async function runRegressionTests() {
  console.log('===============================================================');
  console.log('TASK 1.3 REGRESSION TEST SUITE: CAMPAIGN STOP METRIC FINALIZATION');
  console.log('===============================================================\n');

  const createdCampaignIds = [];
  let allPassed = true;

  try {
    await mongoose.connect(MONGO_URI);
    console.log('[DB] Connected to MongoDB for regression testing.\n');

    // -------------------------------------------------------------
    // TEST 1: Stopping after at least one completed evaluation
    // -------------------------------------------------------------
    console.log('--- [TEST 1] Stopping with completed evaluations ---');
    const campaign1 = await Campaign.create({
      name: '__REGRESSION_TEST_STOP_WITH_EVALS__',
      targetModel: 'gemini-3.5-flash-lite',
      provider: 'gemini',
      status: 'running',
      stopRequested: true,
      requestedPromptCount: 5,
      generatedPromptCount: 5
    });
    createdCampaignIds.push(campaign1._id);

    // Create 2 mock completed evaluations
    const mockPrompt1 = await Prompt.create({
      title: '__REGRESSION_PROMPT_1__',
      text: 'Adversarial prompt 1',
      category: 'jailbreak',
      campaignId: campaign1._id
    });
    const mockPrompt2 = await Prompt.create({
      title: '__REGRESSION_PROMPT_2__',
      text: 'Adversarial prompt 2',
      category: 'jailbreak',
      campaignId: campaign1._id
    });

    await Evaluation.create({
      promptId: mockPrompt1._id,
      campaignId: campaign1._id,
      targetModel: 'gemini-3.5-flash-lite',
      status: 'complete',
      judgeScore: 70,
      isSuccessfulAttack: true
    });
    await Evaluation.create({
      promptId: mockPrompt2._id,
      campaignId: campaign1._id,
      targetModel: 'gemini-3.5-flash-lite',
      status: 'complete',
      judgeScore: 90,
      isSuccessfulAttack: true
    });

    // Run finalization with 'stopped'
    await finalizeCampaignMetrics(campaign1._id, 'stopped');

    const updated1 = await Campaign.findById(campaign1._id);
    console.log(`- status: ${updated1.status} (expected: 'stopped')`);
    console.log(`- completedEvaluationCount: ${updated1.completedEvaluationCount} (expected: 2)`);
    console.log(`- successfulAttackCount: ${updated1.successfulAttackCount} (expected: 2)`);
    console.log(`- attackSuccessRate: ${updated1.attackSuccessRate}% (expected: 100%)`);
    console.log(`- overallScore: ${updated1.overallScore} (expected: 80)`);
    console.log(`- riskLevel: '${updated1.riskLevel}' (expected: 'Critical Risk')`);
    console.log(`- completedAt: ${updated1.completedAt ? 'present' : 'missing'}`);

    const pass1 = updated1.status === 'stopped' &&
      updated1.completedEvaluationCount === 2 &&
      updated1.successfulAttackCount === 2 &&
      updated1.attackSuccessRate === 100 &&
      updated1.overallScore === 80 &&
      updated1.riskLevel === 'Critical Risk' &&
      !!updated1.completedAt;

    console.log(`>>> TEST 1 STATUS: ${pass1 ? 'PASSED \u2705' : 'FAILED \u274c'}\n`);
    if (!pass1) allPassed = false;

    // -------------------------------------------------------------
    // TEST 2: Stopping when there are NO completed evaluations
    // -------------------------------------------------------------
    console.log('--- [TEST 2] Stopping with ZERO completed evaluations ---');
    const campaign2 = await Campaign.create({
      name: '__REGRESSION_TEST_STOP_NO_EVALS__',
      targetModel: 'gemini-3.5-flash-lite',
      provider: 'gemini',
      status: 'generating',
      stopRequested: true,
      requestedPromptCount: 5,
      overallScore: null,
      riskLevel: 'Pending'
    });
    createdCampaignIds.push(campaign2._id);

    await finalizeCampaignMetrics(campaign2._id, 'stopped');

    const updated2 = await Campaign.findById(campaign2._id);
    console.log(`- status: ${updated2.status} (expected: 'stopped')`);
    console.log(`- completedEvaluationCount: ${updated2.completedEvaluationCount} (expected: 0)`);
    console.log(`- successfulAttackCount: ${updated2.successfulAttackCount} (expected: 0)`);
    console.log(`- attackSuccessRate: ${updated2.attackSuccessRate}% (expected: 0%)`);
    console.log(`- overallScore: ${updated2.overallScore} (expected: null, must NOT be 0)`);
    console.log(`- riskLevel: '${updated2.riskLevel}' (expected: 'Pending', must NOT be 'Very Safe')`);

    const pass2 = updated2.status === 'stopped' &&
      updated2.completedEvaluationCount === 0 &&
      updated2.overallScore === null &&
      updated2.riskLevel === 'Pending' &&
      !!updated2.completedAt;

    console.log(`>>> TEST 2 STATUS: ${pass2 ? 'PASSED \u2705' : 'FAILED \u274c'}\n`);
    if (!pass2) allPassed = false;

    // -------------------------------------------------------------
    // TEST 3: Normal finalization retains 'completed' status
    // -------------------------------------------------------------
    console.log('--- [TEST 3] Normal finalization sets completed status ---');
    const campaign3 = await Campaign.create({
      name: '__REGRESSION_TEST_NORMAL_COMPLETE__',
      targetModel: 'gemini-3.5-flash-lite',
      provider: 'gemini',
      status: 'running',
      stopRequested: false,
      requestedPromptCount: 1
    });
    createdCampaignIds.push(campaign3._id);

    const mockPrompt3 = await Prompt.create({
      title: '__REGRESSION_PROMPT_3__',
      text: 'Adversarial prompt 3',
      category: 'jailbreak',
      campaignId: campaign3._id
    });
    await Evaluation.create({
      promptId: mockPrompt3._id,
      campaignId: campaign3._id,
      targetModel: 'gemini-3.5-flash-lite',
      status: 'complete',
      judgeScore: 10,
      isSuccessfulAttack: false
    });

    await finalizeCampaignMetrics(campaign3._id, 'completed');

    const updated3 = await Campaign.findById(campaign3._id);
    console.log(`- status: ${updated3.status} (expected: 'completed')`);
    console.log(`- overallScore: ${updated3.overallScore} (expected: 10)`);
    console.log(`- riskLevel: '${updated3.riskLevel}' (expected: 'Very Safe')`);

    const pass3 = updated3.status === 'completed' &&
      updated3.completedEvaluationCount === 1 &&
      updated3.overallScore === 10 &&
      updated3.riskLevel === 'Very Safe';

    console.log(`>>> TEST 3 STATUS: ${pass3 ? 'PASSED \u2705' : 'FAILED \u274c'}\n`);
    if (!pass3) allPassed = false;

    // -------------------------------------------------------------
    // TEST 4: Stop request during orchestration stops without re-running
    // -------------------------------------------------------------
    console.log('--- [TEST 4] Orchestrator respects stopRequested on boot ---');
    const campaign4 = await Campaign.create({
      name: '__REGRESSION_TEST_STOP_EARLY__',
      targetModel: 'gemini-3.5-flash-lite',
      provider: 'mock',
      executionMode: 'MOCK',
      attackCategories: ['jailbreak'],
      status: 'stopped',
      stopRequested: true,
      requestedPromptCount: 1
    });
    createdCampaignIds.push(campaign4._id);

    // Call orchestrator on stopped campaign
    await runCampaignOrchestrator(campaign4._id);

    const updated4 = await Campaign.findById(campaign4._id);
    console.log(`- status: ${updated4.status} (expected: 'stopped')`);
    const pass4 = updated4.status === 'stopped';
    console.log(`>>> TEST 4 STATUS: ${pass4 ? 'PASSED \u2705' : 'FAILED \u274c'}\n`);
    if (!pass4) allPassed = false;

    console.log('===============================================================');
    console.log(`OVERALL REGRESSION TEST RESULT: ${allPassed ? 'ALL TESTS PASSED \u2705' : 'SOME TESTS FAILED \u274c'}`);
    console.log('===============================================================\n');

  } catch (err) {
    console.error('Regression test runner error:', err);
    allPassed = false;
  } finally {
    // Safe cleanup of only test documents
    console.log('[Cleanup] Removing temporary test documents...');
    await Campaign.deleteMany({ _id: { $in: createdCampaignIds } });
    await Evaluation.deleteMany({ campaignId: { $in: createdCampaignIds } });
    await Prompt.deleteMany({ campaignId: { $in: createdCampaignIds } });
    await mongoose.disconnect();
    console.log('[Cleanup] Completed. Database disconnected.');
  }

  process.exit(allPassed ? 0 : 1);
}

runRegressionTests();
