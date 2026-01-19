# Publishing Guide

## Prerequisites

- npm account with publish access to `@efremidze/swift-mcp`
- Repository write access
- Clean working directory (no uncommitted changes)

## Release Process

### 1. Version Bump

```bash
# For patch releases (bug fixes)
npm version patch

# For minor releases (new features)
npm version minor

# For major releases (breaking changes)
npm version major
```

### 2. Build & Test

```bash
npm run build
npm run test  # Ensure all tests pass
```

### 3. Dry Run

Verify what will be published before actually publishing:

```bash
npm publish --dry-run
```

Review the output to ensure only the intended files are included.

### 4. Publish

```bash
npm publish
```

### 5. Create GitHub Release

```bash
git push origin main
git push origin --tags
```

Then create a release on GitHub with the changelog.

## Pre-Publish Checklist

- [ ] All tests passing
- [ ] README updated (if needed)
- [ ] CHANGELOG updated
- [ ] Version bumped
- [ ] Built successfully
- [ ] Dry run verified
- [ ] Published to npm
- [ ] Git tags pushed
- [ ] GitHub release created

## Troubleshooting

**Authentication Error**
```bash
npm login
```

**Tag Already Exists**
```bash
# Delete local tag
git tag -d v1.0.0

# Delete remote tag
git push origin :refs/tags/v1.0.0
```

**Files Missing in Package**
Check the `files` field in `package.json` and ensure all necessary files are included.
