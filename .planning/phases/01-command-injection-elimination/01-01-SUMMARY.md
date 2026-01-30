---
phase: 01-command-injection-elimination
plan: 01
subsystem: security
tags: [security, command-injection, validation, child_process, execFile]

# Dependency graph
requires:
  - phase: initial
    provides: Existing codebase with vulnerable exec() calls
provides:
  - Safe subprocess invocation using execFile with argument arrays
  - Cookie format validation preventing injection attacks
  - Security hardening against SEC-01 and SEC-03 vulnerabilities
affects: [all-patreon-features, future-subprocess-usage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use execFile with argument arrays instead of exec with shell strings"
    - "Validate all user-controlled input before subprocess use"
    - "Defense-in-depth: combine safe subprocess APIs with input validation"

key-files:
  created: []
  modified:
    - src/sources/premium/patreon-oauth.ts
    - src/sources/premium/patreon-dl.ts

key-decisions:
  - "Use execFile instead of exec to prevent shell interpolation"
  - "Validate cookies with /^[a-zA-Z0-9_-]+$/ regex for defense-in-depth"
  - "Handle Windows 'start' built-in with cmd /c wrapper for cross-platform compatibility"

patterns-established:
  - "Subprocess invocation: Always use execFile with argument arrays, never exec with command strings"
  - "Input validation: Validate format before subprocess use, even with safe APIs"
  - "Cross-platform commands: Handle Windows built-ins differently from macOS/Linux executables"

# Metrics
duration: 2min
completed: 2026-01-29
---

# Phase 01 Plan 01: Command Injection Elimination Summary

**Eliminated command injection vectors by replacing exec() with execFile() and adding cookie format validation for Patreon authentication and download operations**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-29T16:53:08Z
- **Completed:** 2026-01-29T16:55:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced all unsafe exec() calls with safe execFile() using argument arrays in patreon-oauth.ts and patreon-dl.ts
- Added validateCookieValue() function to prevent cookie injection attacks
- Closed SEC-01 (shell command injection) and SEC-03 (cookie injection) vulnerabilities
- Maintained full backward compatibility - all existing tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace exec with execFile in both files** - `a22fcd6` (feat)
2. **Task 2: Add cookie format validation before subprocess use** - `91bce85` (feat)

## Files Created/Modified
- `src/sources/premium/patreon-oauth.ts` - Browser-open commands now use execFile with platform-specific handling (Windows cmd /c, macOS open, Linux xdg-open)
- `src/sources/premium/patreon-dl.ts` - Patreon-dl invocations use execFile with npx and argument arrays; added cookie validation function used in saveCookie, downloadPost, and downloadCreatorContent

## Decisions Made
- **execFile over exec**: Prevents shell interpolation by passing arguments as array instead of command string
- **Windows cmd wrapper**: Handle 'start' built-in by invoking 'cmd /c start' on Windows platform
- **Cookie validation regex**: Use /^[a-zA-Z0-9_-]+$/ to match standard session ID format while rejecting shell metacharacters
- **Validation points**: Validate on write (saveCookie) and before every subprocess use (downloadPost, downloadCreatorContent)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all changes compiled cleanly and tests passed on first run.

## Next Phase Readiness

- **SEC-01 CLOSED**: No shell interpolation in subprocess calls
- **SEC-03 CLOSED**: Cookie values validated before subprocess use
- **Ready for**: Phase 02 (if continuing security improvements) or any feature work depending on vulnerable subprocess invocations
- **No blockers**: All existing download and OAuth functionality preserved

## Technical Details

### Security Improvements

**Before (vulnerable):**
```typescript
// patreon-oauth.ts - line 239
exec(`${cmd} "${authUrl.toString()}"`);  // Shell interprets URL

// patreon-dl.ts - line 143
const cmd = `${PATREON_DL_COMMAND} --no-prompt -c "session_id=${cookie}" -o "${outDir}" "${postUrl}"`;
await execAsync(cmd);  // Shell interprets cookie, paths, URL
```

**After (safe):**
```typescript
// patreon-oauth.ts
execFile(cmd, [authUrl.toString()], (err) => { ... });  // No shell

// patreon-dl.ts
const args = ['--yes', PATREON_DL_PACKAGE, '--no-prompt', '-c', `session_id=${cookie}`, '-o', outDir, postUrl];
await execFileAsync('npx', args, { timeout: 120000 });  // No shell
```

### Cross-Platform Handling

Windows requires special handling because 'start' is a shell built-in, not an executable:
```typescript
if (process.platform === 'win32') {
  execFile('cmd', ['/c', 'start', url], ...);
} else {
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  execFile(cmd, [url], ...);
}
```

### Defense-in-Depth

Even though execFile prevents shell injection, cookie validation provides additional security:
- Rejects unexpected characters that could indicate corruption or tampering
- Validates on write (saveCookie) to prevent invalid data from being stored
- Validates on read (before subprocess use) to catch corruption or manual file editing
- Clear error messages guide users to correct cookie format

---
*Phase: 01-command-injection-elimination*
*Completed: 2026-01-29*
