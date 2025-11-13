# Claude Code - CRITICAL CODE RULES

## FORBIDDEN (ZAPRESHENO)

- Delete or comment out broken code instead of fixing it
- Replace functions with empty stubs (stub functions)
- Delete code "to simplify" without user consent
- Ignore compilation/syntax errors
- Leave commented-out code in repository
- Create TODO comments as replacement for working code

## MANDATORY (OBYAZATELNO)

- Diagnose the ROOT CAUSE of errors before any changes
- Fix the root problem, not just hide symptoms
- If function is broken => FIND AND FIX THE BUG
- If you don't know how to fix => REPORT THE ERROR, but DO NOT DELETE CODE
- TEST after fixing before commit
- Show FULL CODE of functions, not shortcuts like `# ... code ...`

## ERROR FIXING PROCESS (PROCESS ISPRAVLENIYA OSHIBOK)

1. RUN the code and show EXACT error (copy-paste error message)
2. EXPLAIN WHAT broke and WHY (don't just highlight the error)
3. GIVE TWO fix options (if possible)
4. ASK which option is better before making changes
5. MUST TEST after fixing
6. ONLY THEN commit when everything works

## BAD EXAMPLES (BAD PRIMERY)

```javascript
// BAD: stub instead of function
function processImage() {
  // TODO: implement processing
  return null;
}

// BAD: just deleted broken code
// function analyzePhoto(img) {
//   // ... something broken ...
// }

// BAD: code shortening instead of full display
function tryOn() {
  // ... existing code ...
  // NEW CODE HERE
  // ... more code ...
}
```

## GOOD EXAMPLES (GOOD PRIMERY)

```javascript
// GOOD: full fix with explanation
function processImage(imageData) {
  try {
    // Fixed error: was incorrect null check
    if (!imageData || imageData.length === 0) {
      throw new Error('Image data is empty');
    }
    
    const result = analyzeImage(imageData);
    return result;
  } catch (error) {
    console.error('Image processing failed:', error);
    throw error; // Don't hide errors
  }
}

// GOOD: show FULL function code
function validatePhotoUpload(file) {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  
  if (!file) {
    return { valid: false, error: 'File is required' };
  }
  
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File too large' };
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file format' };
  }
  
  return { valid: true };
}
```

## HOW TO GIVE TASKS TO CLAUDE CODE (KAK DAVAT ZADACHI)

When giving a task, use this template:

```
WARNING:
- If code doesn't work => FIX THE BUG, don't delete the function
- Show ALL errors and suggest solutions
- If you break something => restore it and fix properly
- No stubs, only working code
- Before commit check that everything works

TASK: [your task here]
```

## INTEGRATION WITH AGENTS.MD

These rules apply to ALL agent types:
- Frontend Developer
- Backend Architect
- AI Engineer
- Fullstack Developer
- DevOps Engineer
- Test Engineer

NO EXCEPTIONS - these are non-negotiable rules for code quality!
