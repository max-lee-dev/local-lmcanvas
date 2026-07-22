#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$PWD"
RELEASE_STATE_DIR="${LOCAL_LMCANVAS_RELEASE_STATE_DIR:-$HOME/.local/state/local-lmcanvas/release}"
PID_FILE="$RELEASE_STATE_DIR/pid"
STATUS_FILE="$RELEASE_STATE_DIR/status"
LOG_PATH_FILE="$RELEASE_STATE_DIR/current-log"
EXIT_CODE_FILE="$RELEASE_STATE_DIR/exit-code"
SERVICE_LABEL="com.local-lmcanvas.release"
SERVICE_DOMAIN="gui/$(id -u)"
SERVICE_TARGET="$SERVICE_DOMAIN/$SERVICE_LABEL"
PLIST_FILE="$RELEASE_STATE_DIR/$SERVICE_LABEL.plist"

usage() {
  cat <<'EOF'
Usage:
  scripts/release-background.sh start [patch|minor|major|--no-bump]
  scripts/release-background.sh status
  scripts/release-background.sh logs [--follow]

The release continues if the launching terminal or coding-agent session closes.
macOS idle sleep is prevented while the release is running.
EOF
}

read_pid() {
  if [ -f "$PID_FILE" ]; then
    tr -cd '0-9' < "$PID_FILE"
  fi
}

is_running() {
  launchctl print "$SERVICE_TARGET" 2>/dev/null | grep -q 'state = running'
}

current_log() {
  if [ -f "$LOG_PATH_FILE" ]; then
    cat "$LOG_PATH_FILE"
  fi
}

run_release() {
  local bump="$1"
  local exit_code

  printf '%s\n' "$$" > "$PID_FILE"
  printf 'running\n' > "$STATUS_FILE"
  rm -f "$EXIT_CODE_FILE"

  set +e
  /usr/bin/caffeinate -i "$REPO_ROOT/scripts/release.sh" "$bump"
  exit_code=$?
  set -e

  printf '%s\n' "$exit_code" > "$EXIT_CODE_FILE"
  if [ "$exit_code" -eq 0 ]; then
    printf 'succeeded\n' > "$STATUS_FILE"
  else
    printf 'failed\n' > "$STATUS_FILE"
  fi
  return "$exit_code"
}

create_launch_agent() {
  rm -f "$PLIST_FILE"
  /usr/libexec/PlistBuddy -c "Add :Label string $SERVICE_LABEL" "$PLIST_FILE"
  /usr/libexec/PlistBuddy -c "Add :ProgramArguments array" "$PLIST_FILE"
  /usr/libexec/PlistBuddy -c "Add :ProgramArguments:0 string $REPO_ROOT/scripts/release-background.sh" "$PLIST_FILE"
  /usr/libexec/PlistBuddy -c "Add :ProgramArguments:1 string __run" "$PLIST_FILE"
  /usr/libexec/PlistBuddy -c "Add :ProgramArguments:2 string $1" "$PLIST_FILE"
  /usr/libexec/PlistBuddy -c "Add :WorkingDirectory string $REPO_ROOT" "$PLIST_FILE"
  /usr/libexec/PlistBuddy -c "Add :StandardOutPath string $2" "$PLIST_FILE"
  /usr/libexec/PlistBuddy -c "Add :StandardErrorPath string $2" "$PLIST_FILE"
  /usr/libexec/PlistBuddy -c "Add :EnvironmentVariables dict" "$PLIST_FILE"
  /usr/libexec/PlistBuddy -c "Add :EnvironmentVariables:PATH string $PATH" "$PLIST_FILE"
  /usr/libexec/PlistBuddy -c "Add :RunAtLoad bool true" "$PLIST_FILE"
  /usr/libexec/PlistBuddy -c "Add :KeepAlive bool false" "$PLIST_FILE"
  /usr/libexec/PlistBuddy -c "Add :ProcessType string Interactive" "$PLIST_FILE"
  plutil -lint "$PLIST_FILE" >/dev/null
}

start_release() {
  local bump="${1:-patch}"
  local run_id log_file pid

  case "$bump" in
    patch|minor|major|--no-bump) ;;
    *)
      echo "Unknown bump type: $bump" >&2
      usage >&2
      exit 1
      ;;
  esac

  if is_running; then
    echo "A release is already running (PID $(read_pid))."
    echo "Check it with: bun run release:status"
    exit 1
  fi

  if [ -n "$(git status --porcelain)" ]; then
    echo "The repository must be clean before starting a release." >&2
    git status --short >&2
    exit 1
  fi

  mkdir -p "$RELEASE_STATE_DIR"
  run_id="$(date '+%Y%m%d-%H%M%S')"
  log_file="$RELEASE_STATE_DIR/release-$run_id.log"
  printf '%s\n' "$log_file" > "$LOG_PATH_FILE"
  printf 'starting\n' > "$STATUS_FILE"
  rm -f "$EXIT_CODE_FILE"

  launchctl bootout "$SERVICE_TARGET" 2>/dev/null || true
  create_launch_agent "$bump" "$log_file"
  launchctl bootstrap "$SERVICE_DOMAIN" "$PLIST_FILE"

  for _ in 1 2 3 4 5; do
    pid="$(read_pid)"
    [ -n "$pid" ] && break
    sleep 0.2
  done

  echo "Release started as a one-shot macOS background job${pid:+ (PID $pid)}."
  echo "It is safe to close this terminal."
  echo "Status: bun run release:status"
  echo "Logs:   bun run release:logs"
}

show_status() {
  local status="not started"
  local log_file

  if [ -f "$STATUS_FILE" ]; then
    status="$(cat "$STATUS_FILE")"
  fi
  if { [ "$status" = "starting" ] || [ "$status" = "running" ]; } && ! is_running; then
    status="interrupted"
  fi

  echo "Release status: $status"
  if [ -f "$EXIT_CODE_FILE" ]; then
    echo "Exit code: $(cat "$EXIT_CODE_FILE")"
  fi
  log_file="$(current_log)"
  if [ -n "$log_file" ]; then
    echo "Log: $log_file"
  fi
}

show_logs() {
  local follow="${1:-}"
  local log_file
  log_file="$(current_log)"

  if [ -z "$log_file" ] || [ ! -f "$log_file" ]; then
    echo "No release log found." >&2
    exit 1
  fi

  if [ "$follow" = "--follow" ]; then
    tail -n 100 -f "$log_file"
  elif [ -n "$follow" ]; then
    usage >&2
    exit 1
  else
    tail -n 100 "$log_file"
  fi
}

case "${1:-}" in
  start)
    start_release "${2:-patch}"
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs "${2:-}"
    ;;
  __run)
    run_release "${2:-patch}"
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
