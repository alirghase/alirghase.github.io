#!/usr/bin/env bash
# Publish the vault's site/ folder: copy it in, scan for anything private, build, push.
set -euo pipefail
cd "$(dirname "$0")"

# When run from Obsidian, the Terminal setup isn't loaded: find Homebrew and node (nvm) ourselves.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null && [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh" >/dev/null; fi

# The source folder (.source) and the private words to block (.blocklist, one regex) live in
# files that aren't committed, so this public script never names them.
[ -s .source ] || { echo "STOP: .source is missing." >&2; exit 1; }
SRC="$(head -n1 .source)"
[ -s .blocklist ] || { echo "STOP: .blocklist is missing." >&2; exit 1; }
BLOCKED="$(tr -d '\n' < .blocklist)"

mkdir -p content
rsync -a --delete --exclude "README (not published).md" --exclude ".DS_Store" "$SRC" content/
# Drafts (and the templates) never leave this Mac: not built, and not committed to the public repo either.
while IFS= read -r f; do rm -f "$f"; done < <(grep -rl --include="*.md" "^draft: true" content/ || true)

# 1. Remove %% comments %%, copy the images the notes use from the vault, and stop on links to
#    notes outside site/ (they would leak private note names).
node prepare.mjs "$(dirname "${SRC%/}")"

# 2. Private strings (text files only; images can't be scanned, so check them by eye)
if grep -rIniE "$BLOCKED" content/; then
  echo "STOP: private text found above. Fix it in the vault's site/ folder." >&2; exit 1
fi

node build.mjs

if [ "${1:-}" = "--dry-run" ]; then echo "Dry run: not pushed. Preview: npx serve public, or python3 -m http.server -d public"; exit 0; fi
git add -A content
if git diff --cached --quiet; then echo "Nothing new to publish."; exit 0; fi
git commit -q -m "Publish site"
git push -q
echo "Pushed. Live at https://alirghase.github.io in about a minute."
