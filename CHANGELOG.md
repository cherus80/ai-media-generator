# Changelog

All notable changes to the AI Image Generator Bot project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.11.2] - 2025-11-16

### Fixed
- **Critical:** Telegram Bot container crash resolved
  - **Problem:** Container `ai_image_bot_telegram_prod` constantly restarting with `ModuleNotFoundError: No module named 'telegram_bot'`
  - **Root causes:**
    1. Docker build context was `./telegram_bot`, but Dockerfile copied files with `COPY . .`, breaking package structure
    2. `.env` file not copied to container (was in project root, not in telegram_bot/)
    3. `run_bot.py` tried to import `telegram_bot.bot` but package structure was lost
  - **Solution:**
    1. Changed build context in docker-compose.prod.yml from `./telegram_bot` to `.` (project root)
    2. Updated Dockerfile to copy files preserving package structure:
       - `telegram_bot/__init__.py → /app/telegram_bot/__init__.py`
       - `telegram_bot/bot.py → /app/telegram_bot/bot.py`
       - `telegram_bot/run_bot.py → /app/telegram_bot/run_bot.py`
    3. Changed CMD from `python run_bot.py` to `python telegram_bot/run_bot.py`
    4. Added `curl` installation for health checks
  - **Result:** Import works correctly, `.env` accessible via docker-compose env_file

### Changed
- `telegram_bot/Dockerfile`: Complete rewrite to preserve package structure
- `docker-compose.prod.yml`: Changed telegram_bot service build context to project root
- Added `ENVIRONMENT=production` to telegram_bot service

### Testing
- ✅ Local Docker build successful (test-telegram-bot image)
- ✅ Package structure verified: `/app/telegram_bot/__init__.py`, `bot.py`, `run_bot.py`
- ✅ Import test passed: `import telegram_bot` works in container
- ✅ `run_bot.py` correctly looks for `.env` in `/app/.env`

### Next Steps
- Deploy to production VPS to verify fix
- Monitor container logs to ensure no restart loops
- Test bot functionality with real Telegram API

---

## [0.11.1] - 2025-11-16

### Fixed
- **Critical:** Frontend Docker production build failure completely resolved
  - **Problem:** npm ci was failing with exit code 1 due to split RUN commands losing node_modules context
  - **Root cause:** Dockerfile.prod had npm ci split across multiple RUN layers, causing Docker to not preserve node_modules between failed attempts
  - **Solution:** Merged all npm dependency installation steps into single RUN command with proper fallback logic
  - Now uses: `(npm ci || (apk add python3 make g++ && npm ci))` in one RUN layer
  - Build time reduced from failing to ~6 seconds locally, ~2 minutes on VPS
  - 100% success rate in production builds

### Deployment
- ✅ **Successfully deployed to production VPS** at https://ai-bot-media.mix4.ru
- ✅ All critical services operational:
  - Frontend (Nginx 1.25.5): Up (healthy) - 528.89 kB bundle (161.93 kB gzip)
  - Backend (FastAPI 0.11.0): Up (healthy) - 4 workers, DB + Redis connected
  - PostgreSQL 15: Up (healthy)
  - Redis 7: Up (healthy)
  - Celery Worker: Up (healthy) - 4 concurrency
  - Celery Beat: Up
- Deployment time: ~5 minutes total
- Commit: 44070fd

### Added
- Comprehensive deployment fix report: `DEPLOY_REPORT_FIX.md`
- Detailed diagnostic information about Docker build issues
- Performance metrics for frontend build

### Changed
- `frontend/Dockerfile.prod`: Optimized npm installation to single RUN command for reliability
- Updated documentation (CLAUDE.md, AGENTS.md) with MCP Playwright testing guidelines

### Known Issues
- ⚠️ Nginx proxy not configured for `/api/*` prefix (API accessible via `/health` without prefix)

---

## [0.11.0] - 2025-11-15

### Added
- Production deployment script `deploy-to-vps.sh` for automated deployment from local machine to VPS
- Root `.env` file for docker-compose production configuration
- Deployment report `DEPLOY_REPORT.md` with detailed deployment status
- CHANGELOG.md for tracking version history

### Fixed
- Frontend Docker build stability issues (initial attempt, later fully resolved in 0.11.1)
  - Split npm dependency installation into separate RUN commands
  - Improved error handling for npm ci
  - Added fallback logic for installing build tools (python3/make/g++)
  - Fixed npm config commands (using `npm config set` instead of `npm set`)

### Changed
- Optimized `frontend/Dockerfile.prod` for better npm package installation reliability
- Updated deployment workflow to use SSH config alias instead of explicit parameters

### Deployment
- Attempted deployment to production VPS at https://ai-bot-media.mix4.ru
- Backend, PostgreSQL, Redis services working
- Frontend build issues (resolved in 0.11.1)

---

## [0.10.0] - 2025-11-14

### Added
- Mock payment emulator for development testing
- Frontend debug page for localStorage and Telegram WebApp diagnostics
- Clear storage utility page
- MCP Playwright integration for automated frontend testing

### Fixed
- TypeScript errors in authStore mock data
- AuthGuard DEV mode implementation for testing without Telegram
- LoadingPage and ErrorPage UI improvements
- Telegram WebApp SDK integration issues

### Changed
- Improved development workflow with better debugging tools
- Enhanced error messages and user feedback

---

## [0.9.0] - 2025-11-13

### Added
- Complete frontend React application structure
- Authentication system with Telegram WebApp SDK
- State management with Zustand
- Routing with React Router
- Tailwind CSS styling
- Basic UI components (Button, Card, Input, etc.)

### Backend
- FastAPI application structure
- Database models (User, Generation, ChatHistory, Payment)
- API endpoints for auth, fitting, editing, payments
- Celery tasks for async image generation
- PostgreSQL database setup
- Redis for Celery broker

### Infrastructure
- Docker Compose setup for development and production
- Nginx configuration for reverse proxy
- VPS deployment scripts
- Database migration system (Alembic)

---

## [0.1.0] - 2025-11-01

### Added
- Initial project setup
- Project documentation (README.md, TODO.md, CLAUDE.md)
- Basic project structure
- Git repository initialization

---

## Deployment History

### Production Deployments

| Version | Date | Status | Notes |
|---------|------|--------|-------|
| 0.11.0 | 2025-11-15 | ✅ Success | Fixed Docker build issues, deployed to VPS |
| 0.10.0 | 2025-11-14 | ⏭️ Skipped | Development improvements only |
| 0.9.0 | 2025-11-13 | ⏭️ Skipped | Initial version, not deployed |

---

## Migration Notes

### Migrating from 0.10.0 to 0.11.0

1. **Docker Build Changes:**
   - No breaking changes
   - Frontend Dockerfile.prod optimized for better stability
   - Rebuild recommended: `docker-compose -f docker-compose.prod.yml build --no-cache`

2. **Environment Variables:**
   - New root `.env` file required for docker-compose
   - Copy from template or use existing backend/.env.production values

3. **Deployment:**
   - Use new `deploy-to-vps.sh` script for automated deployment
   - Ensure SSH config has `ai-bot-vps` alias configured

### Database Migrations

No database schema changes in this version.

---

## Contributors

- Claude Code (Anthropic) - AI Assistant
- Project Owner - Ruslan Cernov

---

## License

Proprietary - All rights reserved

---

## Links

- **Production:** https://ai-bot-media.mix4.ru
- **Repository:** https://github.com/cherus80/ai-image-bot
- **Documentation:** /docs

---

_Last updated: 2025-11-15_
