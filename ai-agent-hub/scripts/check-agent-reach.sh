#!/usr/bin/env bash
set -euo pipefail

AGENT_REACH_COMMIT="93ae1d18c37b707dec053c7c4f9d91cd8ef8943d"

python -m pip install --upgrade pip
python -m pip install "git+https://github.com/Panniantong/agent-reach.git@${AGENT_REACH_COMMIT}"

agent-reach --help >/dev/null
agent-reach doctor
