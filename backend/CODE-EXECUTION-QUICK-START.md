# Code Execution Quick Start Guide

## 🚀 Using the New V2 Processing

### Frontend (Recommended)

1. Navigate to a meeting: `/meetings/:id`
2. Upload transcript (if not already uploaded)
3. Select **"V2 (Code Execution)"** toggle
4. Click **"Process with AI"**
5. View results in ~25 seconds

### API (Direct)

```bash
# Process meeting with code execution
curl -X POST http://localhost:3000/api/meetings/MEETING_ID/process-v2 \
  -H "Content-Type: application/json"

# Response
{
  "success": true,
  "summary": "✅ Marked STORY-15 as done\n⚠️ Created blocker...",
  "codeGenerated": "const allStories = await stories.findAll(...)",
  "executionTime": 25432
}
```

---

## 📊 Comparison: V1 vs V2

| Feature | V1 (Tool Calling) | V2 (Code Execution) |
|---------|-------------------|---------------------|
| Endpoint | `/process` | `/process-v2` |
| Speed | 40-60s | 20-35s |
| Tokens | 15K-20K | 3K-5K |
| Cost | $0.15-0.25 | $0.03-0.05 |
| API Calls | 3-5 | 1 |
| Inspectable | ❌ | ✅ (view code) |

---

## 🔧 Testing Code Execution

### Run All Tests
```bash
cd backend
npx ts-node test-code-execution.ts
```

### Expected Output
```
═══════════════════════════════════════════
Testing Code Execution Infrastructure
═══════════════════════════════════════════

=== Test 1: Basic Execution ===
✓ Success: true
Output: Hello from sandbox!
Execution time: 1ms

=== Test 2: Access Context Variables ===
✓ Success: true
Output: Project ID: f46354d7-887a-402b-bfb7-eae8f9467cb5

=== Test 3: Stories API ===
✓ Success: true
Output: Found 0 stories

...
All Tests Complete!
```

---

## 💻 Code Executor API Reference

### Available APIs in Sandbox

```typescript
// Get all active (non-done) stories
const stories = await stories.find(projectId);

// Get ALL stories including done
const allStories = await stories.findAll(projectId);

// Find specific story by key
const story = await stories.findByKey('STORY-15', projectId);

// Update story
await stories.update(story.id, {
  status: 'done',
  assigned_to: 'Adam',
  notes: 'Completed during sprint'
});

// Create risk/blocker
await risks.create({
  title: 'Blocker: Client SSO Config',
  description: 'Waiting for client IT team',
  riskType: 'blocker',
  severity: 'high',         // critical, high, medium, low
  stakeholders: ['client IT', 'Adam'],
  needsMeeting: true
});

// Track story change
await storyUpdates.create({
  storyId: story.id,
  fieldChanged: 'status',
  oldValue: 'in_progress',
  newValue: 'done'
});

// Get meeting details
const meeting = await meetings.get(meetingId);

// Log output (appears in summary)
console.log('✅ Marked STORY-15 as done');
console.log('⚠️ Created blocker for SSO');
console.log('📊 Summary: 1 story, 1 blocker');
```

### Context Variables Available

```typescript
projectId   // Current project UUID
meetingId   // Current meeting UUID (optional)
```

---

## 📝 Writing Code Prompts

### Good Prompt Example
```
Process this daily_scrum transcript:

TRANSCRIPT:
Adam: Yesterday I completed STORY-15 (user authentication).
Today working on STORY-18. Blocked on client SSO config.

CONTEXT:
Project: abc-123
Stories:
- STORY-15: User authentication (in_progress, 8 pts)
- STORY-18: Password reset (ready, 5 pts)

Write TypeScript code to update statuses and create blockers.
```

### Generated Code (Example)
```typescript
const allStories = await stories.findAll(projectId);

// Update STORY-15 to done
const story15 = await stories.findByKey('STORY-15', projectId);
if (story15 && story15.status !== 'done') {
  await stories.update(story15.id, { status: 'done' });
  await storyUpdates.create({
    storyId: story15.id,
    fieldChanged: 'status',
    oldValue: 'in_progress',
    newValue: 'done'
  });
  console.log('✅ Marked STORY-15 (User authentication) as done');
}

// Update STORY-18 to in_progress
const story18 = await stories.findByKey('STORY-18', projectId);
if (story18 && story18.status === 'ready') {
  await stories.update(story18.id, { status: 'in_progress' });
  console.log('🔄 Started STORY-18 (Password reset)');
}

// Create blocker
await risks.create({
  title: 'Blocker: Client SSO Configuration',
  description: 'Waiting for client IT team to provide SSO configuration details',
  riskType: 'blocker',
  severity: 'high',
  stakeholders: ['client IT team', 'Adam'],
  needsMeeting: true
});
console.log('⚠️ Created blocker: Client SSO Configuration');

console.log('');
console.log('📊 SUMMARY:');
console.log('✅ Completed: 1 story (STORY-15)');
console.log('🔄 In Progress: 1 story (STORY-18)');
console.log('⚠️ Blockers: 1 (SSO configuration)');
```

---

## 🐛 Troubleshooting

### Code Execution Fails

**Check:**
1. Is sandbox timeout (30s) exceeded?
2. Are database column names correct? (`assigned_to` not `assignee`)
3. Is code syntax valid TypeScript?
4. Review logs: `backend/src/services/meetingProcessorV2.ts`

**Debug:**
```bash
# Run test script
npx ts-node backend/test-code-execution.ts

# Check backend logs
# Look for: "Generated code length:" and "Output:"
```

### No Results Displayed

**Check:**
1. Did API call succeed? (Check browser console)
2. Is `v2Result` state being set?
3. View raw response in Network tab
4. Check for JavaScript errors

### API Credit Error

```
"Your credit balance is too low to access the Anthropic API"
```

**Solution:**
1. Go to https://console.anthropic.com
2. Navigate to Plans & Billing
3. Add credits ($5 minimum)
4. Try again in ~1 minute

---

## 🎯 Best Practices

### 1. Be Conservative
```typescript
// ✅ Good: Check before updating
if (story && story.status !== 'done') {
  await stories.update(story.id, { status: 'done' });
}

// ❌ Bad: Update without checking
await stories.update(story.id, { status: 'done' });
```

### 2. Match Stories Carefully
```typescript
// ✅ Good: Match by key first
const story = await stories.findByKey('STORY-15', projectId);

// ⚠️ Okay: Match by description if needed
const stories = await stories.findAll(projectId);
const story = stories.find(s =>
  s.title.toLowerCase().includes('authentication')
);
```

### 3. Log Clearly
```typescript
// ✅ Good: Use emojis and specifics
console.log('✅ Marked STORY-15 (User auth) as done');
console.log('⚠️ Created blocker: SSO config (high severity)');
console.log('📊 Summary: 2 updates, 1 blocker');

// ❌ Bad: Vague logging
console.log('Updated story');
console.log('Created risk');
```

### 4. Track Changes
```typescript
// ✅ Good: Record what changed
const oldStatus = story.status;
await stories.update(story.id, { status: 'done' });
await storyUpdates.create({
  storyId: story.id,
  fieldChanged: 'status',
  oldValue: oldStatus,
  newValue: 'done'
});

// ❌ Bad: Update without tracking
await stories.update(story.id, { status: 'done' });
```

---

## 📈 Monitoring & Metrics

### Track in Frontend

```typescript
// View execution time
console.log('Executed in:', v2Result.executionTime / 1000, 's');

// View generated code length
console.log('Code length:', v2Result.codeGenerated.length, 'chars');

// View output
console.log('Summary:', v2Result.summary);
```

### Track in Backend

```typescript
// backend/src/services/meetingProcessorV2.ts

console.log('🤖 Asking Claude to generate code...');
console.log('✓ Code generated, executing in sandbox...');
console.log('Generated code length:', code.length);
console.log('✓ Code executed successfully');
console.log('Output:', executionResult.output);
```

---

## 🔗 Related Files

### Backend
- `src/services/codeExecutorSimple.ts` - Sandbox executor
- `src/services/meetingProcessorV2.ts` - V2 processor
- `src/routes/code.ts` - Code execution API
- `src/routes/meetings.ts` - Meeting endpoints
- `test-code-execution.ts` - Test script

### Frontend
- `app/meetings/[id]/page.tsx` - Meeting detail with toggle
- `app/components/MeetingAnalysis.tsx` - V1 analysis display

### Documentation
- `MIGRATION-CODE-EXECUTION.md` - Full migration guide
- `CLAUDE.md` - General project documentation

---

## ✅ Quick Checklist

Before using V2 in production:

- [ ] Backend server running (`npm run dev`)
- [ ] Database connection working
- [ ] Anthropic API key set with credits
- [ ] Test script passes (`npx ts-node test-code-execution.ts`)
- [ ] Frontend showing V2 toggle
- [ ] Can process meeting successfully
- [ ] Results display correctly
- [ ] Generated code is valid

---

## 🎓 Learning Resources

### Example Meetings to Test

**Daily Scrum:**
```
Adam: Yesterday completed STORY-012, today working on STORY-015.
Sarah: Finished STORY-008, starting STORY-020.
Blocker: waiting for client to approve wireframes.
```

**Weekly Status:**
```
Sprint 3 progress: 8/15 stories done, 65 points complete.
STORY-025 blocked on SSO configuration (3 days).
Client happy with demo, requested mobile push notifications.
```

### Common Patterns

**Story Completion:**
```typescript
const story = await stories.findByKey('STORY-XXX', projectId);
if (story && story.status !== 'done') {
  await stories.update(story.id, { status: 'done' });
  console.log('✅ Marked STORY-XXX as done');
}
```

**Blocker Creation:**
```typescript
await risks.create({
  title: 'Blocker: Description',
  description: 'Detailed explanation',
  severity: 'high',
  stakeholders: ['person1', 'person2'],
  needsMeeting: true
});
console.log('⚠️ Created blocker');
```

**Summary Format:**
```typescript
console.log('📊 PROCESSING SUMMARY');
console.log('✅ Completed: X stories');
console.log('🔄 In Progress: Y stories');
console.log('⚠️ Blockers: Z issues');
```

---

**Last Updated:** November 2024
**Version:** 2.0 (Code Execution Architecture)
