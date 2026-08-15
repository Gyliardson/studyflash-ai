import test from "node:test";
import assert from "node:assert/strict";

import {
  claimExamQuestionSubmission,
  examQuestionDeadlineMs,
  remainingExamQuestionSeconds,
} from "../lib/exam-timing.ts";

test("click and timeout racing on the same question accept exactly one submission", () => {
  const clickFirst = claimExamQuestionSubmission(null, 3);
  const timeoutAfterClick = claimExamQuestionSubmission(clickFirst.claimedQuestionIndex, 3);
  assert.equal(clickFirst.accepted, true);
  assert.equal(timeoutAfterClick.accepted, false);

  const timeoutFirst = claimExamQuestionSubmission(null, 3);
  const clickAfterTimeout = claimExamQuestionSubmission(timeoutFirst.claimedQuestionIndex, 3);
  assert.equal(timeoutFirst.accepted, true);
  assert.equal(clickAfterTimeout.accepted, false);
});

test("rapid repeated input is rejected until the exam advances to a new question", () => {
  const first = claimExamQuestionSubmission(null, 0);
  const repeated = claimExamQuestionSubmission(first.claimedQuestionIndex, 0);
  const nextQuestion = claimExamQuestionSubmission(first.claimedQuestionIndex, 1);

  assert.deepEqual(first, { accepted: true, claimedQuestionIndex: 0 });
  assert.deepEqual(repeated, { accepted: false, claimedQuestionIndex: 0 });
  assert.deepEqual(nextQuestion, { accepted: true, claimedQuestionIndex: 1 });
});

test("deadline countdown is monotonic, rounds partial seconds up, and clamps at zero", () => {
  const deadline = examQuestionDeadlineMs(10_000, 20);
  assert.equal(deadline, 30_000);
  assert.equal(remainingExamQuestionSeconds(deadline, 10_000), 20);
  assert.equal(remainingExamQuestionSeconds(deadline, 29_001), 1);
  assert.equal(remainingExamQuestionSeconds(deadline, 30_000), 0);
  assert.equal(remainingExamQuestionSeconds(deadline, 31_000), 0);
});

test("invalid timer or question inputs fail closed", () => {
  assert.throws(() => claimExamQuestionSubmission(null, -1), RangeError);
  assert.throws(() => examQuestionDeadlineMs(Number.NaN, 20), RangeError);
  assert.throws(() => examQuestionDeadlineMs(0, -1), RangeError);
  assert.throws(() => remainingExamQuestionSeconds(Number.POSITIVE_INFINITY, 0), RangeError);
});
