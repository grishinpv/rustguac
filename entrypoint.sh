#!/bin/sh
set -e

# Copy default config on first run (if no config file is mounted/present)
CONFIG_PATH="/opt/rustguac/config.toml"
if [ ! -f "$CONFIG_PATH" ]; then
    echo "No config.toml found — copying default configuration."
    cp /opt/rustguac/config.toml.default "$CONFIG_PATH"
fi

# Resolve db_path: env var > config file > default
if [ -n "${RUSTGUAC_DB_PATH:-}" ]; then
    DB_PATH="$RUSTGUAC_DB_PATH"
else
    DB_PATH=$(grep -E '^\s*db_path\s*=' "$CONFIG_PATH" 2>/dev/null \
        | sed 's/.*=\s*"\(.*\)"/\1/; s/.*=\s*\(.*\)/\1/' | tr -d ' "') || true
    DB_PATH="${DB_PATH:-/opt/rustguac/data/rustguac.db}"
fi

# Create admin API key on first run (if no DB exists yet)
if [ ! -f "$DB_PATH" ]; then
    echo "First run detected — creating admin API key..."
    /opt/rustguac/bin/rustguac --config "$CONFIG_PATH" add-admin --name docker-admin
    echo ""
    echo "==> SAVE THE API KEY ABOVE — it is only shown once! <=="
    echo ""
fi

# Resolve guacd_addr: env var > config file > default
if [ -n "${RUSTGUAC_GUACD_ADDR:-}" ]; then
    GUACD_ADDR="$RUSTGUAC_GUACD_ADDR"
else
    GUACD_ADDR=$(grep -E '^\s*guacd_addr\s*=' "$CONFIG_PATH" 2>/dev/null \
        | sed 's/.*=\s*"\(.*\)"/\1/; s/.*=\s*\(.*\)/\1/' | tr -d ' "') || true
    GUACD_ADDR="${GUACD_ADDR:-127.0.0.1:4822}"
fi
GUACD_HOST="${GUACD_ADDR%:*}"
GUACD_PORT="${GUACD_ADDR##*:}"

# Guacd TLS cert/key — override via env vars to use custom certificates
GUACD_TLS_CERT="${GUACD_TLS_CERT:-/opt/rustguac/tls/cert.pem}"
GUACD_TLS_KEY="${GUACD_TLS_KEY:-/opt/rustguac/tls/key.pem}"

# Start guacd in background
echo "Starting guacd on ${GUACD_HOST}:${GUACD_PORT}..."
LD_LIBRARY_PATH=/opt/rustguac/lib FREERDP_ADDIN_PATH=/opt/rustguac/lib/freerdp3 \
    /opt/rustguac/sbin/guacd \
    -b "$GUACD_HOST" -l "$GUACD_PORT" -L "${GUACD_LOG_LEVEL:-info}" -f \
    -C "$GUACD_TLS_CERT" -K "$GUACD_TLS_KEY" &
GUACD_PID=$!

# Wait briefly to confirm guacd started
sleep 0.5
if ! kill -0 "$GUACD_PID" 2>/dev/null; then
    echo "ERROR: guacd failed to start"
    exit 1
fi
echo "guacd started (pid=$GUACD_PID)"

# Trap signals to shut down both processes
trap 'kill $GUACD_PID 2>/dev/null; wait; exit 0' TERM INT

# Run rustguac in foreground
echo "Starting rustguac..."
exec /opt/rustguac/bin/rustguac --config "$CONFIG_PATH" serve
