# Quick Verification Checklist

Use this checklist to validate that the database persistence fix is working correctly.

## Pre-Testing Setup

- [ ] Worker running: `npm run dev` in `app/worker/`
- [ ] Backend running: `npm run dev` in `app/backend/`
- [ ] DB Browser open on `/app/data/app.db` (or SQLite CLI ready)
- [ ] Terminal tabs visible for logs

## Test 1: Basic Job Persistence (5 min)

**Goal**: Verify that job status DONE persists to database

```bash
# 1. Queue a tracking number
curl -X POST http://localhost:3001/test/payment \
  -H "Content-Type: application/json" \
  -d '{"trackingNumbers": ["1234567890"]}'

Expected output: { "message": "Created 1 jobs" }
```

- [ ] Job created successfully

**In DB Browser**:
```sql
SELECT id, status, attempts, run_after FROM jobs ORDER BY id DESC LIMIT 1;
```

- [ ] Status is `PENDING` initially

**In Worker Logs** (watch for):
```
[POLL] stats: totalCount=1, pending=1, running=0, done=0, failed=0
[JOB] selected eligible id=1 run_after=null...
[PAYMENT_PW] waiting response (slow network mode)
[JOB] after update id=1 status=DONE
[JOB] done id=1
```

- [ ] Logs show "[JOB] after update" (verification passed)
- [ ] Logs show "[JOB] done" (success)

**In DB Browser** (refresh):
```sql
SELECT id, status, attempts FROM jobs WHERE id=1;
```

- [ ] ✅ Status is `DONE` (persisted successfully)
- [ ] ✅ Attempts is `1`

## Test 2: Job Not Re-executed (3 min)

**Goal**: Verify DONE jobs are filtered out (no re-execution)

**In Worker Logs** (next poll cycle):
```
[POLL] stats: totalCount=1, pending=0, running=0, done=1, failed=0
[POLL] stats: totalCount=1, pending=0, running=0, done=1, failed=0
```

- [ ] ✅ No "[JOB] selected eligible" message (job filtered correctly)
- [ ] ✅ Stats show `done=1` consistently

## Test 3: Error Handling & Retries (10 min)

**Goal**: Verify that errors trigger retries with correct state transitions

```bash
# Queue an invalid tracking number
curl -X POST http://localhost:3001/test/payment \
  -H "Content-Type: application/json" \
  -d '{"trackingNumbers": ["INVALID_123"]}'
```

**In Worker Logs** (watch for):
```
[JOB] starting id=2 tracking=INVALID_123
[PAYMENT_PW] waiting response (slow network mode)
✗ [JOB] id=2 tracking=INVALID_123 RETRY (attempt 1/3): <error message>
```

- [ ] Error logged with attempt counter

**In DB Browser**:
```sql
SELECT id, status, attempts, run_after, last_error FROM jobs WHERE id=2;
```

- [ ] ✅ Status is `PENDING` (retry scheduled)
- [ ] ✅ Attempts is `1`
- [ ] ✅ run_after is ~30 seconds in future
- [ ] ✅ last_error contains error message

**Wait 35 seconds**, then check logs for second attempt:

- [ ] ✅ "[JOB] selected eligible id=2" appears again
- [ ] ✅ Second attempt logged as "attempt 2/3"

**After 3 attempts**:
```sql
SELECT id, status, attempts, last_error FROM jobs WHERE id=2;
```

- [ ] ✅ Status is `FAILED`
- [ ] ✅ Attempts is `3`
- [ ] ✅ last_error says "max retries reached"

## Test 4: Multiple Jobs Processing (5 min)

**Goal**: Verify correct job queue ordering and persistence

```bash
# Queue 3 tracking numbers
curl -X POST http://localhost:3001/test/payment \
  -H "Content-Type: application/json" \
  -d '{"trackingNumbers": ["AAA111111", "BBB222222", "CCC333333"]}'
```

**In DB Browser** (immediately):
```sql
SELECT id, status, tracking_number FROM jobs ORDER BY id DESC LIMIT 3;
```

- [ ] ✅ 3 rows with status=PENDING

**In Worker Logs** (watch sequence):
```
[JOB] selected eligible id=3 tracking=AAA111111
[PAYMENT_PW] waiting response (slow network mode)
[JOB] after update id=3 status=DONE    ← Verification for job 3
[JOB] done id=3

[JOB] selected eligible id=4 tracking=BBB222222
[PAYMENT_PW] waiting response (slow network mode)
[JOB] after update id=4 status=DONE    ← Verification for job 4
[JOB] done id=4

[JOB] selected eligible id=5 tracking=CCC333333
[PAYMENT_PW] waiting response (slow network mode)
[JOB] after update id=5 status=DONE    ← Verification for job 5
[JOB] done id=5
```

- [ ] ✅ All 3 jobs show "[JOB] after update" verification
- [ ] ✅ Jobs processed in correct order (FIFO)
- [ ] ✅ No interleaving of jobs

**In DB Browser** (after all complete):
```sql
SELECT id, status, tracking_number FROM jobs 
WHERE tracking_number IN ('AAA111111', 'BBB222222', 'CCC333333')
ORDER BY id;
```

- [ ] ✅ All 3 show status=DONE
- [ ] ✅ Ordering matches job IDs

## Test 5: Database Timestamp Verification (2 min)

**Goal**: Verify updated_at timestamp is current when job completes

**Right after job completes**:
```sql
SELECT id, status, updated_at FROM jobs 
WHERE status='DONE' 
ORDER BY updated_at DESC 
LIMIT 1;
```

- [ ] ✅ updated_at is recent (within last 10 seconds)
- [ ] ✅ Timestamp format is ISO8601 (YYYY-MM-DDTHH:mm:ssZ)

## Test 6: Shipment Data Population (3 min)

**Goal**: Verify that shipments are updated with payment data

**After a job completes successfully**:
```sql
SELECT 
  tracking_number,
  office_status,
  api_success,
  payment_code,
  amount_to_collect,
  api_last_fetch_at
FROM shipments 
WHERE tracking_number = '1234567890'
LIMIT 1;
```

- [ ] ✅ api_success is `1`
- [ ] ✅ payment_code is not null (e.g., 1, 2, or 3)
- [ ] ✅ amount_to_collect is set (should be > 0 or = 0)
- [ ] ✅ api_last_fetch_at is recent

## Test 7: Debug Output Verification (3 min - only if verification fails)

**Goal**: Verify debug output is logged when something goes wrong

If you intentionally break something to test error logging:

```bash
# Example: Corrupt DB to force verification failure
# (Don't do this in real testing, just for validation)
```

**Expected logs when verification fails**:
```
[DEBUG] Status mismatch: expected DONE, got PENDING
[DEBUG] jobs snapshot: [
  { id: 1, status: 'PENDING', attempts: 1, run_after: null },
  { id: 2, status: 'DONE', attempts: 1, run_after: null },
  ...
]
```

- [ ] ✅ Debug snapshot shows full jobs table
- [ ] ✅ Helps identify why verification failed

## Test 8: Network Resilience (5 min)

**Goal**: Verify slow network mode works

Check worker startup logs:

```
[PAYMENT_PW] Playwright configured for SLOW NETWORK MODE
  - Default timeout: 20000ms
  - Navigation timeout: 30000ms
  - Retry on timeout: YES (max 2 attempts)
[POLL] PAYMENT_WEB_DELAY: 1000-2000ms between requests
```

- [ ] ✅ Timeout message shows "20000ms" (not 10000ms)
- [ ] ✅ Retry message shows "YES"
- [ ] ✅ Delay shows "1000-2000ms"

**During job processing**:
```
[PAYMENT_PW] waiting response (slow network mode)
[PAYMENT_PW] retry due to slow connection  ← If timeout occurs
```

- [ ] ✅ Appropriate slow network mode messages logged

## Troubleshooting

### Symptom: "[DEBUG] Job X not found after update!"

**Action**:
1. Check logs for "[DEBUG] jobs snapshot" - what does it show?
2. Is the job there but with RUNNING status? → saveDbImmediate() may not have persisted
3. Is the job missing completely? → Database corruption likely

**Mitigation**: Restart worker (forces fresh DB load)

### Symptom: "Job status not persisted" error

**Action**:
1. Look at debug snapshot - is status PENDING instead of expected?
2. Check file permissions on `/app/data/app.db`
3. Verify file timestamp changed: `ls -la /app/data/app.db`

**Mitigation**: Delete DB and restart: `rm /app/data/app.db && npm run dev`

### Symptom: Multiple jobs interleaving in logs

**Action**:
1. Check concurrency prevention: `isProcessing` flag
2. Look for "[JOB] no eligible jobs" messages
3. Verify LIMIT 10 in SQL query

**Expected**: Only one job RUNNING at a time

## Success Criteria

All tests passing = ✅ Database persistence fixed

| Test | Criteria | Status |
|------|----------|--------|
| Test 1 | Job DONE persists to DB | [ ] |
| Test 2 | DONE jobs not re-executed | [ ] |
| Test 3 | Errors retry with correct state | [ ] |
| Test 4 | Multiple jobs process correctly | [ ] |
| Test 5 | Timestamps accurate | [ ] |
| Test 6 | Shipment data populated | [ ] |
| Test 7 | Debug output helpful | [ ] |
| Test 8 | Network resilience working | [ ] |

**Overall Status**: [ ] PASS / [ ] FAIL

---

**Time Required**: ~40 minutes total (can skip some tests if short on time)

**Minimum Required**: Tests 1-3 (to confirm core fix works)

## Next Steps After Testing

1. ✅ If all tests pass: Proceed to production deployment
2. ❌ If any test fails: Refer to troubleshooting or consult `DATABASE_PERSISTENCE_FIX.md`
3. Monitor: Watch logs for any verification messages during deployment

---

**Last Updated**: 2024-01-15
**Fix Applied**: Database verification helper function + 4 state transitions updated
