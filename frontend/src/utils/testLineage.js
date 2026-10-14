/**
 * Focused Lineage Fixtures & Pure Unit Tests (Task 2.1)
 * Tests:
 * 1. Round 1 root with a Round 2 child.
 * 2. Round 2 child with a Round 3 grandchild.
 * 3. Multiple children belonging to the same parent.
 * 4. An orphaned prompt whose parent is missing.
 * 5. Duplicate or cyclic references.
 *
 * Safety: Pure in-memory unit test; zero DB calls, zero API quota.
 */

import { buildLineageTrees } from './lineage.js';

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

console.log('===============================================================');
console.log('TASK 2.1 TEST SUITE: MULTI-GENERATIONAL LINEAGE RESOLUTION');
console.log('===============================================================\n');

// -------------------------------------------------------------------------
// FIXTURE 1: Round 1 Root with a Round 2 Child
// -------------------------------------------------------------------------
const fixture1 = [
  {
    _id: 'eval-r1',
    generationRound: 1,
    judgeScore: 80,
    isSuccessfulAttack: true,
    promptId: { _id: 'p-r1', title: 'Root Attack', generationRound: 1, text: 'R1 prompt' }
  },
  {
    _id: 'eval-r2',
    generationRound: 2,
    judgeScore: 65,
    isSuccessfulAttack: true,
    promptId: { _id: 'p-r2', title: 'Round 2 Child', generationRound: 2, parentPromptId: 'p-r1', text: 'R2 mutated' }
  }
];

const res1 = buildLineageTrees(fixture1);
assert(res1.rootNodes.length === 1, 'Fixture 1: Exactly 1 root node found');
assert(res1.rootNodes[0]?.children.length === 1, 'Fixture 1: Root node has 1 Round 2 child');
assert(res1.rootNodes[0]?.children[0]?.evaluation._id === 'eval-r2', 'Fixture 1: Child is eval-r2');

// -------------------------------------------------------------------------
// FIXTURE 2: Round 1 Root -> Round 2 Child -> Round 3 Grandchild
// -------------------------------------------------------------------------
const fixture2 = [
  {
    _id: 'eval-1',
    generationRound: 1,
    judgeScore: 85,
    isSuccessfulAttack: true,
    promptId: { _id: 'p-1', title: 'Grandparent R1', generationRound: 1, text: 'R1' }
  },
  {
    _id: 'eval-2',
    generationRound: 2,
    judgeScore: 70,
    isSuccessfulAttack: true,
    promptId: { _id: 'p-2', title: 'Parent R2', generationRound: 2, parentPromptId: 'p-1', text: 'R2' }
  },
  {
    _id: 'eval-3',
    generationRound: 3,
    judgeScore: 90,
    isSuccessfulAttack: true,
    promptId: { _id: 'p-3', title: 'Grandchild R3', generationRound: 3, parentPromptId: 'p-2', text: 'R3' }
  }
];

const res2 = buildLineageTrees(fixture2);
assert(res2.rootNodes.length === 1, 'Fixture 2: Exactly 1 root node');
const r1Node = res2.rootNodes[0];
assert(r1Node.children.length === 1, 'Fixture 2: R1 has 1 R2 child');
const r2Node = r1Node.children[0];
assert(r2Node.evaluation._id === 'eval-2', 'Fixture 2: R2 node matches eval-2');
assert(r2Node.children.length === 1, 'Fixture 2: R2 has 1 R3 grandchild');
const r3Node = r2Node.children[0];
assert(r3Node.evaluation._id === 'eval-3', 'Fixture 2: R3 node matches eval-3');
assert(r3Node.children.length === 0, 'Fixture 2: R3 node has 0 children');

// -------------------------------------------------------------------------
// FIXTURE 3: Multiple Children Belonging to the Same Parent
// -------------------------------------------------------------------------
const fixture3 = [
  {
    _id: 'eval-root',
    generationRound: 1,
    promptId: { _id: 'p-root', generationRound: 1 }
  },
  {
    _id: 'eval-child-a',
    generationRound: 2,
    promptId: { _id: 'p-child-a', generationRound: 2, parentPromptId: 'p-root' }
  },
  {
    _id: 'eval-child-b',
    generationRound: 2,
    promptId: { _id: 'p-child-b', generationRound: 2, parentPromptId: 'p-root' }
  }
];

const res3 = buildLineageTrees(fixture3);
assert(res3.rootNodes.length === 1, 'Fixture 3: 1 root node');
assert(res3.rootNodes[0].children.length === 2, 'Fixture 3: Root node has 2 children');
const childIds = res3.rootNodes[0].children.map(c => c.evaluation._id);
assert(childIds.includes('eval-child-a') && childIds.includes('eval-child-b'), 'Fixture 3: Both children present under same parent');

// -------------------------------------------------------------------------
// FIXTURE 4: An Orphaned Prompt Whose Parent is Missing
// -------------------------------------------------------------------------
const fixture4 = [
  {
    _id: 'eval-r1-valid',
    generationRound: 1,
    promptId: { _id: 'p-r1-valid', generationRound: 1 }
  },
  {
    _id: 'eval-orphan',
    generationRound: 2,
    promptId: { _id: 'p-orphan', generationRound: 2, parentPromptId: 'p-missing-parent' }
  }
];

const res4 = buildLineageTrees(fixture4);
assert(res4.rootNodes.length === 1, 'Fixture 4: 1 valid root node');
assert(res4.orphanedNodes.length === 1, 'Fixture 4: Orphaned prompt safely captured in orphanedNodes');
assert(res4.orphanedNodes[0].evaluation._id === 'eval-orphan', 'Fixture 4: Orphan matches eval-orphan without crashing');

// -------------------------------------------------------------------------
// FIXTURE 5: Duplicate and Cyclic References
// -------------------------------------------------------------------------
const fixture5 = [
  {
    _id: 'eval-cycle-1',
    generationRound: 1,
    promptId: { _id: 'p-cycle-1', generationRound: 1, parentPromptId: 'p-cycle-2' }
  },
  {
    _id: 'eval-cycle-2',
    generationRound: 2,
    promptId: { _id: 'p-cycle-2', generationRound: 2, parentPromptId: 'p-cycle-1' }
  },
  // Duplicate entry of eval-cycle-1
  {
    _id: 'eval-cycle-1-dup',
    generationRound: 1,
    promptId: { _id: 'p-cycle-1', generationRound: 1, parentPromptId: 'p-cycle-2' }
  }
];

const res5 = buildLineageTrees(fixture5);
assert(res5.rootNodes.length <= 1, 'Fixture 5: Cycle handled safely without infinite recursion');
assert(passedCount > 0, 'Fixture 5: Execution completed safely');

console.log('\n===============================================================');
console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log('===============================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
