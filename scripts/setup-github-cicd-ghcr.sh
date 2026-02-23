#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REPO="cherus80/ai-media-generator"

print_info() {
  printf '[INFO] %s\n' "$*"
}

print_warn() {
  printf '[WARN] %s\n' "$*" >&2
}

print_error() {
  printf '[ERROR] %s\n' "$*" >&2
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    print_error "Required command not found: $1"
    exit 1
  fi
}

prompt_value() {
  local label="$1"
  local default_value="${2-}"
  local value=""

  if [[ -n "$default_value" ]]; then
    printf '%s [%s]: ' "$label" "$default_value" >&2
  else
    printf '%s: ' "$label" >&2
  fi
  IFS= read -r value || true

  if [[ -z "$value" ]]; then
    value="$default_value"
  fi

  printf '%s' "$value"
}

prompt_secret() {
  local label="$1"
  local value=""

  printf '%s: ' "$label" >&2
  IFS= read -r -s value || true
  printf '\n' >&2
  printf '%s' "$value"
}

expand_home_path() {
  local path="$1"
  if [[ "$path" == "~" ]]; then
    printf '%s' "$HOME"
    return
  fi
  if [[ "$path" == ~/* ]]; then
    printf '%s' "${HOME}/${path#~/}"
    return
  fi
  printf '%s' "$path"
}

get_ssh_identity_default() {
  local identity=""
  if command -v ssh >/dev/null 2>&1; then
    identity="$(ssh -G ai-bot-vps 2>/dev/null | awk '/^identityfile /{print $2; exit}' || true)"
  fi
  if [[ -n "$identity" ]]; then
    expand_home_path "$identity"
    return
  fi
  if [[ -f "$HOME/.ssh/id_ed25519" ]]; then
    printf '%s' "$HOME/.ssh/id_ed25519"
    return
  fi
  if [[ -f "$HOME/.ssh/id_rsa" ]]; then
    printf '%s' "$HOME/.ssh/id_rsa"
    return
  fi
  printf '%s' "$HOME/.ssh/id_ed25519"
}

get_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || pwd
}

read_dotenv_value() {
  local key="$1"
  local file="$2"
  [[ -f "$file" ]] || return 1
  awk -F= -v key="$key" '
    $1 == key {
      sub(/^[^=]*=/, "", $0)
      print $0
      exit
    }
  ' "$file"
}

set_gh_secret_from_stdin() {
  local repo="$1"
  local name="$2"
  print_info "Setting GitHub Secret: $name"
  gh secret set "$name" --repo "$repo"
}

set_gh_secret_from_value() {
  local repo="$1"
  local name="$2"
  local value="$3"
  printf '%s' "$value" | set_gh_secret_from_stdin "$repo" "$name"
}

set_gh_secret_from_file() {
  local repo="$1"
  local name="$2"
  local file="$3"
  print_info "Setting GitHub Secret from file: $name"
  gh secret set "$name" --repo "$repo" < "$file"
}

set_gh_variable() {
  local repo="$1"
  local name="$2"
  local value="$3"
  print_info "Setting GitHub Variable: $name"
  gh variable set "$name" --repo "$repo" --body "$value"
}

set_gh_variable_if_present() {
  local repo="$1"
  local name="$2"
  local value="$3"
  if [[ -z "$value" ]]; then
    print_info "Skipping empty GitHub Variable: $name"
    return
  fi
  set_gh_variable "$repo" "$name" "$value"
}

prompt_nonempty() {
  local label="$1"
  local default_value="${2-}"
  local value=""
  while true; do
    value="$(prompt_value "$label" "$default_value")"
    if [[ -n "$value" ]]; then
      printf '%s' "$value"
      return
    fi
    print_warn "Value is required."
  done
}

main() {
  local repo_root repo
  local vps_host vps_port vps_username ssh_key_path ghcr_username ghcr_token
  local vite_api_base_url vite_app_name vite_google_client_id vite_vk_app_id
  local vite_vk_redirect_uri vite_vk_auth_url vite_yandex_client_id vite_yandex_redirect_uri
  local vite_telegram_bot_name vite_yandex_metrika_id
  local local_vite_api_default local_vite_app_default
  local answer

  require_cmd gh
  require_cmd git

  if ! gh auth status -h github.com >/dev/null 2>&1; then
    print_error "GitHub CLI is not authenticated. Run: gh auth login"
    exit 1
  fi

  repo_root="$(get_repo_root)"
  repo="$(prompt_value "GitHub repo (owner/name)" "$DEFAULT_REPO")"
  if [[ -z "$repo" ]]; then
    print_error "Repository is required."
    exit 1
  fi

  print_info "Checking repository access: $repo"
  gh repo view "$repo" >/dev/null

  local_vite_api_default="$(read_dotenv_value "VITE_API_BASE_URL" "$repo_root/.env" || true)"
  if [[ -z "$local_vite_api_default" ]]; then
    local_vite_api_default="$(read_dotenv_value "VITE_API_BASE_URL" "$repo_root/frontend/.env" || true)"
  fi
  if [[ -z "$local_vite_api_default" ]]; then
    local_vite_api_default="https://ai-generator.mix4.ru"
  fi

  local_vite_app_default="$(read_dotenv_value "VITE_APP_NAME" "$repo_root/frontend/.env" || true)"
  if [[ -z "$local_vite_app_default" ]]; then
    local_vite_app_default="AI Generator"
  fi

  print_info "Enter GitHub Actions Secrets (sensitive values are hidden and not printed)."
  vps_host="$(prompt_nonempty "VPS host (domain or IP)")"
  vps_port="$(prompt_nonempty "VPS SSH port" "22")"
  vps_username="$(prompt_nonempty "VPS SSH username" "root")"

  while true; do
    ssh_key_path="$(prompt_nonempty "Path to SSH private key for deploy" "$(get_ssh_identity_default)")"
    ssh_key_path="$(expand_home_path "$ssh_key_path")"
    if [[ ! -f "$ssh_key_path" ]]; then
      print_warn "File not found: $ssh_key_path"
      continue
    fi
    if grep -Eq 'BEGIN (OPENSSH|RSA|EC|DSA) PRIVATE KEY' "$ssh_key_path"; then
      break
    fi
    print_warn "File does not look like a private key: $ssh_key_path"
  done

  ghcr_username="$(prompt_nonempty "GitHub username for GHCR read access on VPS")"
  while true; do
    ghcr_token="$(prompt_secret "GHCR read token (PAT with read:packages)")"
    if [[ -n "$ghcr_token" ]]; then
      break
    fi
    print_warn "Token is required."
  done

  print_info "Enter GitHub Actions Variables for frontend build (non-sensitive). Empty values are allowed except VITE_API_BASE_URL."
  vite_api_base_url="$(prompt_nonempty "VITE_API_BASE_URL (recommended: site origin without /api)" "$local_vite_api_default")"
  vite_app_name="$(prompt_value "VITE_APP_NAME" "$local_vite_app_default")"
  vite_google_client_id="$(prompt_value "VITE_GOOGLE_CLIENT_ID (optional)")"
  vite_vk_app_id="$(prompt_value "VITE_VK_APP_ID (optional)")"
  vite_vk_redirect_uri="$(prompt_value "VITE_VK_REDIRECT_URI (optional)" "https://ai-generator.mix4.ru/vk/callback")"
  vite_vk_auth_url="$(prompt_value "VITE_VK_AUTH_URL" "https://id.vk.com/authorize")"
  vite_yandex_client_id="$(prompt_value "VITE_YANDEX_CLIENT_ID (optional)")"
  vite_yandex_redirect_uri="$(prompt_value "VITE_YANDEX_REDIRECT_URI (optional)" "https://ai-generator.mix4.ru/yandex/callback")"
  vite_telegram_bot_name="$(prompt_value "VITE_TELEGRAM_BOT_NAME (optional, without @)")"
  vite_yandex_metrika_id="$(prompt_value "VITE_YANDEX_METRIKA_ID (optional)")"

  print_info "Applying GitHub Secrets..."
  set_gh_secret_from_value "$repo" "VPS_HOST" "$vps_host"
  set_gh_secret_from_value "$repo" "VPS_PORT" "$vps_port"
  set_gh_secret_from_value "$repo" "VPS_USERNAME" "$vps_username"
  set_gh_secret_from_file "$repo" "VPS_SSH_KEY" "$ssh_key_path"
  set_gh_secret_from_value "$repo" "VPS_GHCR_USERNAME" "$ghcr_username"
  set_gh_secret_from_value "$repo" "VPS_GHCR_READ_TOKEN" "$ghcr_token"

  print_info "Applying GitHub Variables..."
  set_gh_variable "$repo" "VITE_API_BASE_URL" "$vite_api_base_url"
  set_gh_variable "$repo" "VITE_APP_NAME" "${vite_app_name:-AI Generator}"
  set_gh_variable_if_present "$repo" "VITE_GOOGLE_CLIENT_ID" "$vite_google_client_id"
  set_gh_variable_if_present "$repo" "VITE_VK_APP_ID" "$vite_vk_app_id"
  set_gh_variable_if_present "$repo" "VITE_VK_REDIRECT_URI" "$vite_vk_redirect_uri"
  set_gh_variable "$repo" "VITE_VK_AUTH_URL" "${vite_vk_auth_url:-https://id.vk.com/authorize}"
  set_gh_variable_if_present "$repo" "VITE_YANDEX_CLIENT_ID" "$vite_yandex_client_id"
  set_gh_variable_if_present "$repo" "VITE_YANDEX_REDIRECT_URI" "$vite_yandex_redirect_uri"
  set_gh_variable_if_present "$repo" "VITE_TELEGRAM_BOT_NAME" "$vite_telegram_bot_name"
  set_gh_variable_if_present "$repo" "VITE_YANDEX_METRIKA_ID" "$vite_yandex_metrika_id"

  unset ghcr_token

  print_info "Done. Values were sent to GitHub Actions Secrets/Variables for $repo."
  print_info "You can verify names only (without values): gh secret list --repo \"$repo\" && gh variable list --repo \"$repo\""

  answer="$(prompt_value "Run Deploy to Production workflow now? (y/N)" "N")"
  if [[ "$answer" =~ ^[Yy]$ ]]; then
    print_info "Triggering workflow: Deploy to Production (ref=master)"
    gh workflow run "Deploy to Production" --repo "$repo" --ref master
    print_info "Recent runs:"
    gh run list --repo "$repo" --workflow "Deploy to Production" --limit 5
  else
    print_info "Skipped workflow run."
  fi
}

main "$@"
