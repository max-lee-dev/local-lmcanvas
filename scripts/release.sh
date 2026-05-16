#!/usr/bin/env bash
# Build, sign, notarize, staple, tag, and publish a new release of LMCanvas.
#
# Usage:
#   scripts/release.sh                  # patch bump (0.1.0 → 0.1.1)
#   scripts/release.sh minor            # minor bump
#   scripts/release.sh major            # major bump
#   scripts/release.sh --no-bump        # use current version in package.json
#
# Required env vars (export before running):
#   APPLE_ID                       Apple ID email
#   APPLE_APP_SPECIFIC_PASSWORD    xxxx-xxxx-xxxx-xxxx (from appleid.apple.com)
#   APPLE_TEAM_ID                  10-char team identifier
#
# Optional env vars:
#   RELEASE_NOTES                  free-text body of the GitHub release
#   SKIP_GIT_PUSH=1                build + notarize only, don't tag/push/release

set -euo pipefail

# -------- prelude --------

cd "$(dirname "$0")/.."
REPO_ROOT="$PWD"

# Auto-source .env.release if present (gitignored — for APPLE_ID etc.)
if [ -f "$REPO_ROOT/.env.release" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env.release"
  set +a
fi
cyan()   { printf "\033[36m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*" >&2; }
section(){ echo; cyan "=== $* ==="; }

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    red "Missing required env var: $name"
    exit 1
  fi
}

# -------- preconditions --------

section "Preconditions"
require_env APPLE_ID
require_env APPLE_APP_SPECIFIC_PASSWORD
require_env APPLE_TEAM_ID

command -v bun >/dev/null    || { red "bun not installed";       exit 1; }
command -v xcrun >/dev/null  || { red "xcode tools not installed"; exit 1; }
command -v gh >/dev/null     || { red "gh CLI not installed";    exit 1; }
gh auth status -h github.com >/dev/null 2>&1 || { red "gh CLI not authenticated"; exit 1; }

if ! security find-identity -p codesigning -v 2>/dev/null \
     | grep -q "Developer ID Application"; then
  red 'No "Developer ID Application" identity found in keychain.'
  red "Generate one at developer.apple.com → Certificates → Developer ID Application."
  exit 1
fi
green "✓ env, tools, signing identity"

# -------- version --------

section "Version"
BUMP="${1:-patch}"
if [ "$BUMP" = "--no-bump" ]; then
  yellow "Skipping version bump (--no-bump)"
elif [ "$BUMP" != "patch" ] && [ "$BUMP" != "minor" ] && [ "$BUMP" != "major" ]; then
  red "Unknown bump type: $BUMP. Use patch | minor | major | --no-bump"
  exit 1
else
  npm version "$BUMP" --no-git-tag-version >/dev/null
fi
VERSION="$(node -p "require('./package.json').version")"
PRODUCT_NAME="$(node -p "require('./package.json').build.productName")"
green "✓ Building $PRODUCT_NAME v$VERSION"

# -------- build --------

section "Build (electron-builder)"
bun run dist

ARM64_DMG="$REPO_ROOT/dist/${PRODUCT_NAME}-${VERSION}-arm64.dmg"
INTEL_DMG="$REPO_ROOT/dist/${PRODUCT_NAME}-${VERSION}.dmg"
ARM64_BLOCKMAP="${ARM64_DMG}.blockmap"
INTEL_BLOCKMAP="${INTEL_DMG}.blockmap"
LATEST_YML="$REPO_ROOT/dist/latest-mac.yml"

# DMGs are user-facing; .blockmap + latest-mac.yml are required by
# electron-updater to discover and delta-download new versions.
REQUIRED_ARTIFACTS=("$ARM64_DMG" "$INTEL_DMG" "$ARM64_BLOCKMAP" "$INTEL_BLOCKMAP" "$LATEST_YML")
for f in "${REQUIRED_ARTIFACTS[@]}"; do
  if [ ! -f "$f" ]; then
    red "Expected build output missing: $f"
    red "Files actually produced:"
    ls -1 "$REPO_ROOT/dist/" | sed 's/^/  /' >&2
    exit 1
  fi
done
green "✓ Built ${ARM64_DMG##*/} and ${INTEL_DMG##*/} (+ blockmaps, latest-mac.yml)"

# -------- notarize + staple DMG containers --------
# electron-builder notarizes the .app inside but does NOT notarize the .dmg
# container. Without the DMG staple, Gatekeeper blocks downloads with a
# warning even though the .app is fine.

notarize_submit() {
  local dmg="$1"
  local log="$2"
  xcrun notarytool submit "$dmg" \
    --apple-id    "$APPLE_ID" \
    --password    "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id     "$APPLE_TEAM_ID" \
    --wait > "$log" 2>&1
}

section "Notarize ARM64 + Intel DMGs in parallel"
ARM64_LOG="$REPO_ROOT/dist/.notarize-arm64.log"
INTEL_LOG="$REPO_ROOT/dist/.notarize-intel.log"

notarize_submit "$ARM64_DMG" "$ARM64_LOG" &
ARM64_PID=$!
notarize_submit "$INTEL_DMG" "$INTEL_LOG" &
INTEL_PID=$!

wait "$ARM64_PID" || { red "ARM64 notarize failed"; cat "$ARM64_LOG" >&2; exit 1; }
green "✓ ARM64 notarized"
wait "$INTEL_PID" || { red "Intel notarize failed";  cat "$INTEL_LOG"  >&2; exit 1; }
green "✓ Intel notarized"

section "Staple + validate DMGs"
for dmg in "$ARM64_DMG" "$INTEL_DMG"; do
  xcrun stapler staple "$dmg"
  xcrun stapler validate "$dmg"
  green "✓ Stapled $(basename "$dmg")"
done

# -------- git tag + push --------

if [ "${SKIP_GIT_PUSH:-0}" = "1" ]; then
  yellow "SKIP_GIT_PUSH=1 set — leaving git state untouched. Local builds only:"
  echo "  $ARM64_DMG"
  echo "  $INTEL_DMG"
  exit 0
fi

section "Git tag + push"
TAG="v$VERSION"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [ -n "$(git status --porcelain)" ]; then
  git add package.json
  git commit -m "🚀 release $TAG"
fi
git tag "$TAG"
git push origin "$BRANCH"
git push origin "$TAG"
green "✓ Tagged $TAG on $BRANCH"

# -------- github release --------

section "GitHub release"
NOTES="${RELEASE_NOTES:-Release $TAG. Signed + notarized macOS DMGs for Apple Silicon and Intel.}"
gh release create "$TAG" \
  "$ARM64_DMG" \
  "$INTEL_DMG" \
  "$ARM64_BLOCKMAP" \
  "$INTEL_BLOCKMAP" \
  "$LATEST_YML" \
  --title "$TAG" \
  --notes "$NOTES"

green ""
green "Released $PRODUCT_NAME $TAG"
green "  Apple Silicon: ${ARM64_DMG##*/}"
green "  Intel:         ${INTEL_DMG##*/}"
green "  GitHub:        https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/$TAG"
green ""
yellow "Next: update marketing site VERSION + redeploy (see scripts/release.sh comment)."
