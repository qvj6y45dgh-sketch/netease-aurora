#!/bin/zsh
set -eu
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
node scripts/launch.mjs enable || { print '\n按回车关闭'; read -r; exit 1; }
