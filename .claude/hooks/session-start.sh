#!/bin/bash
# Deja disponible graphify (paquete graphifyy, Apache-2.0) en las sesiones de Claude Code en la web.
# El skill está en .claude/skills/graphify; este script solo instala la herramienta de línea de comandos.
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
if ! command -v graphify >/dev/null 2>&1; then
  pip install -q graphifyy >/dev/null 2>&1 || echo "No se pudo instalar graphify (sin acceso a PyPI)" >&2
fi
exit 0
