# Claude Code Configuration

This directory contains all configuration for Claude Code to work effectively on the AI Media Generator project.

## 📁 Structure

```
.claude/
├── agents/              # Specialized AI agents (9 total)
├── skills/              # Reusable capabilities (4 total)
├── hooks/               # Automated workflows (9 total)
├── commands/            # Custom slash commands (6 total)
├── project-index.json   # File index for quick navigation
├── settings.json        # Claude Code settings
└── README.md           # This file
```

---

## 🤖 Agents (9 specialists)

Each agent is a specialized AI assistant for specific tasks. They are automatically selected based on task keywords or can be invoked manually.

### 1. **Frontend Developer** (`frontend-developer.md`)
- **Focus**: React components, Tailwind CSS, Zustand state management
- **Triggers**: UI, interface, component, React, TypeScript, CSS
- **Tools**: Read, Write, Edit, Bash
- **Model**: Sonnet

### 2. **UI/UX Designer** (`ui-ux-designer.md`)
- **Focus**: Design systems, Telegram Mini App UX, visual design
- **Triggers**: design, UX, wireframe, color, typography, theme
- **Tools**: Read, Write, Edit, Bash
- **Model**: Sonnet

### 3. **Backend Architect** (`backend-architect.md`)
- **Focus**: FastAPI, SQLAlchemy, async operations, API integrations
- **Triggers**: API, endpoint, database, FastAPI, Python, SQLAlchemy
- **Tools**: Read, Write, Edit, Bash, Grep, Glob
- **Model**: Sonnet

### 4. **Fullstack Developer** (`fullstack-developer.md`)
- **Focus**: End-to-end features, React + FastAPI integration
- **Triggers**: fullstack, feature, integration, API-UI, data flow
- **Tools**: Read, Write, Edit, Bash, Grep, Glob
- **Model**: Sonnet

### 5. **AI Engineer** (`ai-engineer.md`)
- **Focus**: kie.ai integration, OpenRouter, image processing
- **Triggers**: photo, image, AI, kie.ai, Nano Banana, OpenRouter
- **Tools**: Read, Write, Edit, Bash, Grep, Glob
- **Model**: Sonnet

### 6. **Prompt Engineer** (`prompt-engineer.md`)
- **Focus**: Prompt optimization, Stable Diffusion, Claude Haiku
- **Triggers**: prompt, generation, GPT, Claude, Stable Diffusion
- **Tools**: Read, Write, Edit
- **Model**: Sonnet

### 7. **Test Engineer** (`test-engineer.md`)
- **Focus**: pytest, Jest, debugging, test coverage
- **Triggers**: test, debug, bug, quality, CI/CD
- **Tools**: Read, Write, Edit, Bash, Grep, Glob
- **Model**: Sonnet

### 8. **DevOps Engineer** (`devops-engineer.md`)
- **Focus**: Docker, PostgreSQL, Redis, monitoring, infrastructure
- **Triggers**: docker, infrastructure, monitoring, database, Redis
- **Tools**: Read, Write, Edit, Bash, Grep, Glob
- **Model**: Sonnet

### 9. **Deployment Engineer** (`deployment-engineer.md`)
- **Focus**: Production deployment, rollback, migrations, VPS
- **Triggers**: deploy, deployment, production, VPS, migration
- **Tools**: Read, Write, Edit, Bash, Grep
- **Model**: Sonnet

---

## 🎯 Skills (4 capabilities)

Reusable capabilities that agents can leverage for specific tasks.

### Development Skills

1. **Artifacts Builder** (`development/artifacts-builder.md`)
   - Build complete React components or FastAPI endpoints
   - Includes tests, types, documentation
   - Production-ready code with error handling

2. **MCP Builder** (`development/mcp-builder.md`)
   - Build external API integrations (kie.ai, OpenRouter, YuKassa)
   - Retry logic, error handling, monitoring
   - Model-Context-Protocol pattern

3. **WebApp Testing** (`development/webapp-testing.md`)
   - Comprehensive testing for Telegram Mini Apps
   - Unit tests (pytest, Jest), integration tests, E2E
   - Telegram WebApp SDK mocking

### Design Skills

4. **Theme Factory** (`creative-design/theme-factory.md`)
   - Generate consistent design systems
   - Tailwind CSS configuration
   - Color palettes, typography, spacing, component variants

---

## 🪝 Hooks (9 automated workflows)

Hooks are scripts that run automatically at specific events.

### Always Enabled ✅

1. **Lint on Save** (`development-tools/lint-on-save.sh`)
   - Trigger: After file edit/write
   - Runs ESLint for JS/TS, syntax check for Python
   - Auto-fixes simple issues

2. **File Backup** (`development-tools/file-backup.sh`)
   - Trigger: Before file edit/write
   - Creates timestamped backups
   - Keeps last 5 backups per file

3. **Security Scanner** (`security/security-scanner.sh`)
   - Trigger: After file edit/write
   - Detects hardcoded secrets, SQL injection, XSS
   - Blocks .env file commits

4. **Smart Commit** (`git-workflow/smart-commit.sh`)
   - Trigger: Before git commit
   - Generates commit message templates
   - Conventional Commits format (feat, fix, docs, etc.)

### Optional (enabled per task)

5. **Format JavaScript** (`post-tool/format-javascript-files.sh`)
   - Trigger: After editing frontend files
   - Prettier or ESLint auto-fix
   - Code formatting

6. **Run Tests After Changes** (`post-tool/run-tests-after-changes.sh`)
   - Trigger: After editing code files
   - Runs related unit tests automatically
   - Fast feedback loop

7. **Telegram Notifications** (`automation/telegram-notifications.sh`)
   - Trigger: After deployment, critical events
   - Sends notifications to Telegram bot
   - Requires: TELEGRAM_NOTIFICATION_BOT_TOKEN

8. **Telegram Detailed Notifications** (`automation/telegram-detailed-notifications.sh`)
   - Trigger: After major operations
   - Detailed reports (deployment, migration, test results)
   - System information included

9. **Test Runner** (`testing/test-runner.sh`)
   - Trigger: Manual or after changes
   - Runs unit, integration, or all tests
   - Generates test summary reports

---

## 📋 Commands (6 slash commands)

Custom commands for common tasks.

- `/plan` - Create implementation plan
- `/review` - Code review with suggestions
- `/fix` - Debug and fix issues
- `/explain` - Explain code functionality
- `/api-integrate` - API integration workflow
- `/Go_to_TODO` - Jump to TODO.md tasks

---

## 🚀 Usage

### Agent Selection

Agents are automatically selected based on keywords in your request:

```
"Fix the React component" → Frontend Developer
"Update the database schema" → Backend Architect
"Deploy to production" → Deployment Engineer
```

### Manual Agent Invocation

```bash
# Use specific agent
@backend-architect Please review the API endpoints

# Combine agents
@fullstack-developer @test-engineer Implement feature with tests
```

### Hook Configuration

Hooks run automatically. To disable:
1. Remove execute permission: `chmod -x .claude/hooks/path/to/hook.sh`
2. Or delete the hook file

### Skill Usage

Skills are referenced by agents automatically. Example:

```
"Build a complete payment component"
→ Frontend Developer uses Artifacts Builder skill
```

---

## 📊 Statistics

- **Agents**: 9 specialized AI assistants
- **Skills**: 4 reusable capabilities
- **Hooks**: 9 automated workflows (4 always enabled)
- **Commands**: 6 custom slash commands
- **Total Configuration Files**: 30+

---

## 🔧 Maintenance

### Adding New Agent

1. Create `agents/new-agent.md` with YAML frontmatter:
```yaml
---
name: new-agent
description: Agent purpose and trigger keywords
tools: Read, Write, Edit, Bash
model: sonnet
---
```

2. Update `AGENTS.md` routing section
3. Test with relevant keyword triggers

### Adding New Hook

1. Create `hooks/category/new-hook.sh`
2. Make executable: `chmod +x hooks/category/new-hook.sh`
3. Add trigger documentation
4. Test in isolation before enabling

### Adding New Skill

1. Create `skills/category/new-skill.md`
2. Document capabilities and usage patterns
3. Reference from relevant agents
4. Add examples

---

## 📖 References

- **AGENTS.md** - Agent routing and configuration
- **CODE_RULES.md** - Code quality rules (no truncation, no duplicates)
- **CLAUDE.md** - Project-specific guidance for Claude Code
- **project-index.json** - File index for quick navigation

---

## ⚠️ Important Notes

### Protected Files (Never Modify)

From AGENTS.md critical rules:
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `.env` (production)
- `vps-deploy-script.sh`

### Code Quality Rules

All agents MUST follow CODE_RULES.md:
- ❌ Never truncate code with `# ... existing code ...`
- ❌ Never create duplicate functions/components
- ❌ Never delete functionality without permission
- ✅ Always show full code
- ✅ Always test after changes
- ✅ Always check for existing implementations first

### Security

The security-scanner hook will **block commits** containing:
- Hardcoded API keys (sk-..., test_...)
- .env files (except .env.example)
- Potential SQL injection patterns
- Dangerous eval/exec usage

---

## 🎯 Quick Start

1. **Use agents**: Just describe your task naturally
2. **Enable hooks**: Already enabled for critical workflows
3. **Run commands**: Use `/command` in chat
4. **Check project-index.json**: Fast file navigation

Example workflow:
```
You: "Add a new payment method to the backend"
→ Backend Architect agent selected
→ Artifacts Builder skill used
→ Lint on Save hook runs
→ Security Scanner checks code
→ Run Tests hook validates changes
→ Smart Commit generates message
```

---

**Last Updated**: 2024-01-14
**Version**: 1.0.0
**Maintained By**: Claude Code
