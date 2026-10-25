#!/usr/bin/env bash
# Publish the vault's site/ folder: copy it in, scan for anything private, build, push.
set -euo pipefail
cd "$(dirname "$0")"

# When run from Obsidian, the Terminal setup isn't loaded: find Homebrew and node (nvm) ourselves.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null && [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh" >/dev/null; fi

SRC="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Obsidian Vault/site/"
BLOCKED='@gmail\.com|@icloud\.com|/Users/|alirezaghasemi|Mobile Documents|Lloyds|\bLBG\b|Shiraz|marriage|alighasemi2620|alir\.ghase'

mkdir -p content
rsync -a --delete --exclude "README (not published).md" --exclude ".DS_Store" "$SRC" content/

# 1. Private strings
if grep -rniE "$BLOCKED" content/; then
  echo "STOP: private text found above. Fix it in the vault's site/ folder." >&2; exit 1
fi

# 2. Links to notes outside site/ (they would leak private note names)
missing=0
while IFS= read -r target; do
  base="${target##*/}"
  if [ -z "$(find content -name "$base.md" -print -quit)" ]; then
    echo "STOP: [[$target]] links to a note that isn't in site/." >&2; missing=1
  fi
done < <(grep -rhoE '\[\[[^]|#\\]+' content/ | sed 's/^\[\[//' | sort -u)
[ "$missing" -eq 0 ] || exit 1

node build.mjs

if [ "${1:-}" = "--dry-run" ]; then echo "Dry run: not pushed. Preview: npx serve public, or python3 -m http.server -d public"; exit 0; fi
git add -A content
if git diff --cached --quiet; then echo "Nothing new to publish."; exit 0; fi
git commit -q -m "Publish site"
git push -q
echo "Pushed. Live at https://alirghase.github.io in about a minute."
