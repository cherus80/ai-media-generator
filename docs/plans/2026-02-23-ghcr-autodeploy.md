# GHCR Autodeploy (master) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Настроить автодеплой production через GitHub Actions + GHCR с точным `sha`-тегом для VPS `/root/ai-image-bot`.

**Architecture:** Workflow `deploy.yml` собирает и пушит образы `backend/frontend` в GHCR с тегами `latest` и `sha-<commit>`. На VPS `docker-compose.prod.yml` использует `image:` с переменной `IMAGE_TAG`, а deploy script делает `pull`, `up -d`, миграции и health-check.

**Tech Stack:** GitHub Actions, GHCR, Docker Compose, SSH (appleboy/ssh-action), FastAPI, Vite

---

### Task 1: Align CI triggers with `master`

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Update branch triggers**

- Change `push` and `pull_request` branches from `main/develop` to `master`.

**Step 2: Prevent missing Telegram bot build from failing CI**

- Remove or conditionally skip `telegram_bot` Docker build step because `telegram_bot/` is absent in current repo.

### Task 2: Build/push GHCR images with deterministic tags

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Step 1: Update deploy trigger**

- Switch deploy branch trigger and job condition to `master`.
- Add `workflow_dispatch` for manual reruns from GitHub UI.

**Step 2: Publish `latest` + `sha-<commit>`**

- Build and push only `backend` and `frontend`.
- Tag both images with `latest` and `sha-${{ github.sha }}`.

**Step 3: Pass frontend build-time args**

- Provide `VITE_*` values via GitHub `vars`/`secrets` in `build-args`.

### Task 3: Make production compose pullable from GHCR

**Files:**
- Modify: `docker-compose.prod.yml`

**Step 1: Add image references**

- Add `image:` for `backend`, `celery_worker`, `celery_beat`, `frontend`.
- Keep existing `build:` blocks as fallback.

**Step 2: Add tag variable support**

- Use `${IMAGE_TAG:-latest}` in image tags.

### Task 4: Deploy exact SHA on VPS via SSH

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Step 1: Update VPS path and branch**

- Use `/root/ai-image-bot` and `git pull origin master`.

**Step 2: Login to GHCR and deploy exact tag**

- Export `IMAGE_TAG=sha-${GITHUB_SHA}` in SSH script.
- Run `docker login ghcr.io`, `docker-compose pull`, `docker-compose up -d`.
- Run `alembic upgrade head` and backend health-check.

### Task 5: Document required GitHub secrets/vars

**Files:**
- Create: `docs/GHCR_CICD_SETUP.md`
- Modify: `CONTINUITY.md`

**Step 1: Document setup**

- List required GitHub `Secrets` and `Variables` (VPS SSH, GHCR read token for VPS, `VITE_*`).

**Step 2: Update continuity**

- Record chosen rollout pattern and any known follow-up checks.
