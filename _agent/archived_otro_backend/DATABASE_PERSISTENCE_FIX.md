# Database Persistence Fix - Testing & Validation Guide

## Problem Resolved

**Issue**: Job status verification returning `undefined` after successful UPDATE operations
- Logs showed: `[JOB] done id=1` (indicating success)
- Database showed: status still `PENDING` (indicating persistence failure)
- Root cause: Named parameter binding in sql.js was broken

## Solution Implemented

### 1. Robust Job Verification Helper

Created `verifyJobStatus(jobId, expectedStatus)` function in `app/worker/src/services/jobs.ts`:

```typescript
function verifyJobStatus(jobId: number, expectedStatus: string): boolean {
  try {
    const check = all<{ id: number; status: string }>(
      `SELECT id, status FROM jobs WHERE id = ${Number(jobId)} LIMIT 1`,
      {}
    )[0];
    
    if (!check) {
      console.log(`[DEBUG] Job ${jobId} not found after update!`);
      console.log(`[DEBUG] jobs snapshot:`, /* full jobs table */);
      return false;
    }
    
    if (check.status === expectedStatus) {
      console.log(`[JOB] after update id=${check.id} status=${check.status}`);
      return true;
    } else {
      console.log(`[DEBUG] Status mismatch: expected ${expectedStatus}, got ${check.status}`);
      console.log(`[DEBUG] jobs snapshot:`, /* full jobs table */);
      return false;
    }
  } catch (error) {
    console.error(`[ERROR] verifyJobStatus failed:`, error);
    return false;
  }
}
```

**Key improvements**:
- Uses `all()` instead of `get()` (sql.js compatibility)
- Uses SQL string concatenation instead of named params: `WHERE id = ${Number(jobId)}`
- Returns `false` if verification fails (instead of throwing)
- Logs full jobs table snapshot when debugging (shows actual DB state)
- Wrapped in try-catch to prevent crashes

### 2. Updated All Job State Transitions

Replaced all `get()` verification calls with robust `verifyJobStatus()`:

| State | Location | Verification |
|-------|----------|--------------|
| DONE (success) | Line ~180 | `verifyJobStatus(id, "DONE")` |
| DONE (data anomaly) | Line ~140 | `verifyJobStatus(id, "DONE")` |
| FAILED (max retries) | Line ~240 | `verifyJobStatus(id, "FAILED")` |
| PENDING (retry scheduled) | Line ~265 | `verifyJobStatus(id, "PENDING")` |

### 3. Ensured Persistence After Every Critical UPDATE

Every UPDATE statement now followed by `saveDbImmediate()`:

```typescript
// UPDATE operation
run(`UPDATE jobs SET status = 'DONE', updated_at = ? WHERE id = ?`, { now, id });

// Force immediate persistence (no debounce)
saveDbImmediate();

// Robust verification
if (!verifyJobStatus(id, "DONE")) {
  throw new Error(`Job status not persisted`);
}
```

Pattern applied to:
- `UPDATE jobs SET status='DONE'` (2 places: success + anomaly)
- `UPDATE jobs SET status='FAILED'` (error with max retries)
- `UPDATE jobs SET status='PENDING'` (error with retry)

## Testing & Validation

### Prerequisites
- Worker running: `npm run dev` in `app/worker/`
- Backend running: `npm run dev` in `app/backend/`
- DB Browser (or SQLite viewer) open on `/app/data/app.db`

### Test Steps

#### 1. Check Initial Database State
```bash
# In DB Browser: Execute query
SELECT id, status, attempts, run_after FROM jobs ORDER BY id DESC LIMIT 5;
```
Expected: Should show previous jobs (if any)

#### 2. Queue New Tracking Numbers
```bash
# POST to backend test endpoint
curl -X POST http://localhost:3001/test/payment \
  -H "Content-Type: application/json" \
  -d '{
    "trackingNumbers": ["1234567890", "0987654321", "1111111111"]
  }'
```

Expected: Jobs created with `status='PENDING'`

#### 3. Observe Worker Processing

In worker terminal, look for:
```
[POLL] stats: totalCount=3, pending=3, running=0, done=0, failed=0
[JOB] starting id=1 tracking=1234567890
[PAYMENT_PW] waiting response (slow network mode)
[JOB] after update id=1 status=DONE
[JOB] done id=1
```

**Debug output when verification fails**:
```
[DEBUG] Job 1 not found after update!
[DEBUG] jobs snapshot: [
  { id: 1, status: 'RUNNING', attempts: 1, run_after: null },
  { id: 2, status: 'PENDING', attempts: 0, run_after: null },
  ...
]
```

#### 4. Verify Database State

While worker is running:
```bash
# In DB Browser: Refresh and check jobs table
SELECT id, status, attempts, run_after, last_error, updated_at FROM jobs ORDER BY id DESC;
```

**Expected progression**:
1. First query: `id=1, status='RUNNING'` (job being processed)
2. After job completes: `id=1, status='DONE'` (persisted successfully)
3. Next poll: `id=2, status='RUNNING'` (moving to next job)

#### 5. Check Shipments Updated

```bash
# In DB Browser
SELECT tracking_number, office_status, api_success, payment_code, amount_to_collect 
FROM shipments 
WHERE tracking_number IN ('1234567890', '0987654321', '1111111111')
ORDER BY updated_at DESC;
```

Expected: Should see payment data filled in for completed jobs

#### 6. Verify No Re-execution of DONE Jobs

After all jobs complete (status=DONE), check worker logs:
```
[POLL] stats: totalCount=3, pending=0, running=0, done=3, failed=0
[POLL] stats: totalCount=3, pending=0, running=0, done=3, failed=0
```

No more `[JOB] starting` messages (jobs not being re-processed)

#### 7. Test Error Handling & Retries

Queue invalid tracking numbers:
```bash
curl -X POST http://localhost:3001/test/payment \
  -H "Content-Type: application/json" \
  -d '{
    "trackingNumbers": ["invalid123"]
  }'
```

Expected flow:
1. First attempt: `status='RUNNING'`, `attempts=1`
2. Error occurs, retry scheduled: `status='PENDING'`, `attempts=1`, `run_after=<30s future>`
3. After 30s: `status='RUNNING'`, `attempts=2`
4. After 3 attempts: `status='FAILED'`, `attempts=3`, `last_error=<message>`

Verify each state transition persists to database.

## Troubleshooting

### Symptom: Verification shows `[DEBUG] jobs snapshot:` with all PENDING status

**Possible causes**:
1. `saveDbImmediate()` not actually writing to disk
2. File permissions on `/app/data/app.db`
3. sql.js memory not syncing with file

**Action**:
- Check file permissions: `ls -la /app/data/app.db`
- Verify file is being modified: `stat /app/data/app.db`
- Restart worker: Forces fresh DB load

### Symptom: "[ERROR] verifyJobStatus failed:" in logs

**Possible causes**:
1. Exception in `all()` query
2. Database locked or corrupted

**Action**:
- Check full error message in logs
- Delete `/app/data/app.db` and restart (creates fresh DB)
- Verify no other processes accessing the file

### Symptom: Jobs marked DONE but not appearing in DB Browser

**Possible causes**:
1. DB Browser cached results
2. File on disk not actually updated

**Action**:
- Refresh DB Browser: Press Ctrl+R or close/reopen
- Check file timestamp: Has it changed?
- Query SQLite directly: `sqlite3 /app/data/app.db "SELECT * FROM jobs;"`

## Success Criteria

✅ All tests passing when:
1. Jobs marked DONE immediately appear as DONE in database
2. Jobs not re-executed after completion (status=DONE filters them)
3. Error retries follow expected backoff (30s, then 60s, then FAILED)
4. Shipment data populated correctly after successful payment fetch
5. Logs show "[JOB] after update id=X status=DONE" without verification errors

## Files Modified

- `app/worker/src/services/jobs.ts`: Added `verifyJobStatus()` helper, replaced all verification calls
- `CHANGELOG.md`: Documented changes

## Next Steps (After Successful Testing)

1. Test with actual InterRapidísimo tracking numbers (not test endpoint)
2. Monitor job queue under load (100+ jobs)
3. Test database recovery after worker crash
4. Implement persistence metrics/monitoring
