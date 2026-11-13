#!/bin/sh
cd "$(dirname "$0")" || exit 1
if [ ! -f data/auth.json ]; then node server/setup.mjs || exit 1; fi
exec node server/index.mjs
