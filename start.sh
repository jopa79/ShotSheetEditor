#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# start.sh — ShotSheet Editor Entwicklungsserver
# ============================================================================
# Startet die Electron-App im Entwicklungsmodus via electron-vite.
# electron-vite buendelt Main-Process, Preload und Renderer (Svelte 5)
# in einem einzigen Kommando mit Hot-Reload.
# ============================================================================

# --- Farben fuer Terminal-Ausgabe ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # Keine Farbe

# --- Projektverzeichnis ermitteln (relativ zum Skript) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# --- Freien Port finden ---
find_free_port() {
  local port
  while true; do
    port=$(shuf -i 3000-9999 -n 1)
    if ! lsof -i :"$port" &>/dev/null; then
      echo "$port"
      return
    fi
  done
}

# --- Aufraeumen bei Beendigung ---
# Alle Kind-Prozesse beenden wenn das Skript beendet wird
cleanup() {
  echo ""
  echo -e "${YELLOW}Beende alle Prozesse...${NC}"
  # Alle Hintergrund-Prozesse dieser Shell beenden
  kill $(jobs -p) 2>/dev/null || true
  wait 2>/dev/null || true
  echo -e "${GREEN}Alle Prozesse beendet.${NC}"
}
trap cleanup EXIT INT TERM

# --- Voraussetzungen pruefen ---
echo -e "${CYAN}=== ShotSheet Editor — Entwicklungsserver ===${NC}"
echo ""

# Node.js pruefen
if ! command -v node &>/dev/null; then
  echo -e "${RED}Fehler: Node.js ist nicht installiert oder nicht im PATH.${NC}"
  echo "Installation: https://nodejs.org/"
  exit 1
fi
NODE_VERSION=$(node --version)
echo -e "  Node.js:       ${GREEN}${NODE_VERSION}${NC}"

# npm pruefen
if ! command -v npm &>/dev/null; then
  echo -e "${RED}Fehler: npm ist nicht installiert oder nicht im PATH.${NC}"
  exit 1
fi
NPM_VERSION=$(npm --version)
echo -e "  npm:           ${GREEN}v${NPM_VERSION}${NC}"

# FFmpeg pruefen (wird von der App benoetigt)
if command -v ffmpeg &>/dev/null; then
  FFMPEG_VERSION=$(ffmpeg -version 2>&1 | head -1 | awk '{print $3}')
  echo -e "  FFmpeg:        ${GREEN}${FFMPEG_VERSION}${NC}"
else
  echo -e "  FFmpeg:        ${YELLOW}nicht gefunden (wird zur Laufzeit benoetigt)${NC}"
fi

echo ""

# --- Dependencies pruefen und ggf. installieren ---
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}node_modules nicht gefunden — installiere Dependencies...${NC}"
  npm install
  echo ""
fi

# --- Freien Port fuer den Vite Dev-Server ermitteln ---
VITE_PORT=$(find_free_port)

# --- Starten ---
echo -e "${CYAN}Starte electron-vite im Entwicklungsmodus...${NC}"
echo -e "  Vite Dev-Server Port: ${GREEN}${VITE_PORT}${NC}"
echo -e "  Modus:                ${GREEN}development${NC}"
echo ""
echo -e "${YELLOW}Druecke Ctrl+C zum Beenden.${NC}"
echo ""

# electron-vite dev startet:
#   1. Vite Dev-Server fuer den Renderer (Svelte 5 + HMR)
#   2. Electron Main-Process mit dem gebauten Main-Eintrag
# Der Port wird via Umgebungsvariable an Vite uebergeben
VITE_DEV_SERVER_PORT="$VITE_PORT" npx electron-vite dev --port "$VITE_PORT" &
ELECTRON_PID=$!

echo -e "${GREEN}electron-vite gestartet (PID: ${ELECTRON_PID})${NC}"

# Auf den Hauptprozess warten
wait $ELECTRON_PID
