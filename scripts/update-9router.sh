#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE="9router.service"
PORT="${NINEROUTER_PORT:-20128}"

cd "$REPO_DIR"

status="$(git status --porcelain)"
allowed_status=$' M package.json\n?? scripts/update-9router.sh'
if [[ -n "$status" && "$status" != "$allowed_status" ]]; then
  printf 'Update dibatalkan: perubahan lokal belum disimpan di %s.\n' "$REPO_DIR" >&2
  printf 'Commit atau stash perubahan tersebut, lalu jalankan lagi.\n' >&2
  exit 1
fi

printf '==> Memperbarui 9router CLI global\n'
npm i -g 9router@latest --prefer-online

printf '==> Menggabungkan source terbaru dari origin/master\n'
git fetch origin master --tags
git merge --no-edit origin/master

printf '==> Memasang dependensi source\n'
npm install --prefer-online

printf '==> Membangun aplikasi\n'
npm run build

printf '==> Me-restart %s\n' "$SERVICE"
systemctl --user restart "$SERVICE"

printf '==> Memverifikasi instalasi dan layanan\n'
printf 'CLI: '
9router --version
systemctl --user is-active --quiet "$SERVICE"
curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:${PORT}/api/health" >/dev/null
printf 'Service: aktif; health: OK; source: %s\n' "$(node -p "require('./package.json').version")"
