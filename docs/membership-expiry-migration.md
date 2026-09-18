# Membership expiry security fix

The legacy Firestore fallback now accepts only `expiresAt is timestamp` and
`expiresAt > request.time`, for sponsor articles and wellness articles/videos.
Strings (including future strings), missing values and invalid types fail closed.
Canonical entitlements, activity permissions and membership benefit policy are unchanged.
The two admin writers now save Timestamp values and admin.html refreshes their cache tokens.

## Verification

Requires Node 22+, Java 21 and Python 3.9+:

```sh
npm ci --prefix tests/firestore
npm test --prefix tests/firestore
python3 -B -m unittest discover -s scripts/tests -p 'test_normalize_member_expiry.py'
node scripts/lock-paid-article-access-policy.mjs
node scripts/audit-production-stability.mjs
node --check membership-admin.js
node --check wellness-member-admin.js
```

The emulator uses only the `demo-membership-expiry` project. Tests cover expired,
future, malformed, absent and incorrectly typed expiry values with absent, stale
and incomplete entitlements. They exercise actual paidArticleBodies/memberVideos
reads, plus ordinary wellness, canonical, suspension and unauthenticated controls.

## Production migration and release

Opening this PR does not migrate data or deploy rules. Merging firestore.rules to
main triggers the existing Firestore deployment workflow. Complete the migration
preflight before merging; coordinate a short pause in manual membership edits and
reload admin.html after the new version is published. Payment callbacks already
write Timestamp values and can continue normally.

Use an authorized gcloud identity. Save the reports outside the repository in a
private directory; they contain member document IDs and original expiry values.
No credentials or reports belong in GitHub or Actions artifacts.

```sh
python3 -B scripts/normalize-member-expiry.py \
  --project lyyuan03-membership --report /private/tmp/member-expiry-preview.json
# Review the private report before the next command. Use a new filename each run.
python3 -B scripts/normalize-member-expiry.py \
  --project lyyuan03-membership --report /private/tmp/member-expiry-applied.json --apply
python3 -B scripts/normalize-member-expiry.py \
  --project lyyuan03-membership --report /private/tmp/member-expiry-verified.json
```

The tool scans both memberAccess and sponsorMemberAccess, paginates all documents,
and preserves the instant of timezone-qualified ISO strings. It does not extend
expired membership or change status, benefits, permissions, updatedAt, or payments.
Missing/null/Timestamp expiry values remain unchanged. Ambiguous dates, malformed
strings or other field types are reported and block all writes for that invocation;
resolve these from authoritative membership records, never assume a new expiry.
No conversion is needed for event-only records with no membership expiry.

Apply saves its own fresh inventory and backup before writing. Each PATCH masks
only expiresAt and requires the original document updateTime. If a concurrent
payment or admin update wins, the tool stops rather than overwriting it. Earlier
successful conversions remain valid; rescan and rerun using a new report path.
Repeat the dry-run until convertible and invalid counts are both zero.

Rebuild memberEntitlements using the existing approved reconciliation process;
its source triggers also react to conversions. The existing deployment workflow
already rebuilds entitlements before publishing rules. Verify the production
stability audit and the repository's five-load Chromium smoke test before release.
After merge, verify the Firestore workflow succeeded at the intended commit and
inspect the active Firebase rules release. Smoke-test current sponsor/wellness
members and an expired test member with direct Firestore reads; inspect both paid
articles and member videos. Do not mark the incident resolved until production
migration, deployed rules, and access verification are complete.

If valid access breaks, inspect the source expiry and entitlement sync. Do not
restore the string-accepting rules. Fix affected data with concurrency guards;
restoring the former fallback reopens the vulnerability.

## Remaining work

Verified-admin checks, App Check/rate limiting, and articleMetrics abuse prevention
are separate fixes and are not claimed to be resolved by this PR.
