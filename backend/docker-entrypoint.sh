#!/bin/sh
# docker-entrypoint.sh — Script khởi động Backend container
# Chờ MySQL sẵn sàng → chạy migration → start server

set -e

echo "🐳 Maverik Store Backend Container Starting..."

# ── Chờ MySQL sẵn sàng ────────────────────────────
echo "⏳ Waiting for MySQL at $MYSQL_HOST:$MYSQL_PORT..."

MAX_RETRIES=30
COUNT=0

until nc -z "$MYSQL_HOST" "$MYSQL_PORT" 2>/dev/null; do
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $MAX_RETRIES ]; then
    echo "❌ MySQL did not become ready in time. Exiting."
    exit 1
  fi
  echo "   Attempt $COUNT/$MAX_RETRIES — MySQL not ready, retrying in 3s..."
  sleep 3
done

echo "✅ MySQL is ready!"

# ── Thêm 3 giây buffer để MySQL hoàn toàn init xong ──
sleep 3

# ── Sync schema trực tiếp vào DB mới (bỏ qua migration history) ──
echo "🔄 Pushing Prisma schema to database..."
npx prisma db push --accept-data-loss
echo "✅ Schema synced!"

# ── Start Server ──────────────────────────────────
echo "🚀 Starting Maverik Store API on port $PORT..."
exec npx tsx src/server.ts
