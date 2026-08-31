import test from "node:test";
import assert from "node:assert/strict";
import { jinmuEventArticles } from "../../jinmu-event-series.js";
import { JINMU_PERMISSIONS, validateJinmuPermissionPlan } from "../../jinmu-permission-plan.js";

const plan = (records, stats = { am: 1, pm: 0, both: 0, patron: 0, supporter: 0 }) => ({ schemaVersion: 1, records, stats, manualReview: [] });
test("four existing articles expose metadata only and four distinct permissions", () => {
  assert.equal(jinmuEventArticles.length, 4);
  assert.equal(new Set(jinmuEventArticles.map((a) => a.id)).size, 4);
  assert.deepEqual(jinmuEventArticles.map((a) => a.requiredPermission), JINMU_PERMISSIONS);
  jinmuEventArticles.forEach((article) => {
    assert.equal(article.slug, article.id);
    assert.equal(article.content, "");
    assert.ok(article.series && article.accessBadge);
    assert.equal(article.accessType, "event");
  });
});
test("normalizes Gmail and unions duplicate permission rows", () => {
  const result = validateJinmuPermissionPlan(plan([
    { email: " MEMBER@GMAIL.COM ", permissions: [JINMU_PERMISSIONS[0]] },
    { email: "member@gmail.com", permissions: [JINMU_PERMISSIONS[1]] }
  ], { am: 1, pm: 1, both: 1, patron: 0, supporter: 0 }));
  assert.deepEqual(result.records, [{ email: "member@gmail.com", permissions: JINMU_PERMISSIONS.slice(0, 2) }]);
});
test("rejects non-Gmail, empty Email, unknown permissions and manual-review records", () => {
  for (const email of ["", "member@example.com", "member@googlemail.com", "member@gmail.com.evil.example"]) {
    assert.throws(() => validateJinmuPermissionPlan(plan([{ email, permissions: [JINMU_PERMISSIONS[0]] }])));
  }
  assert.throws(() => validateJinmuPermissionPlan(plan([{ email: "member@gmail.com", permissions: ["2026-jinmu-both"] }])));
  const review = plan([{ email: "member@gmail.com", permissions: [JINMU_PERMISSIONS[0]] }]);
  review.manualReview = [{ email: "member@gmail.com" }];
  assert.throws(() => validateJinmuPermissionPlan(review));
});
test("patron must include supporter; inconsistent statistics fail closed", () => {
  assert.throws(() => validateJinmuPermissionPlan(plan([{ email: "member@gmail.com", permissions: [JINMU_PERMISSIONS[2]] }])));
  assert.throws(() => validateJinmuPermissionPlan(plan([{ email: "member@gmail.com", permissions: [JINMU_PERMISSIONS[0]] }], { am: 99 })));
});
