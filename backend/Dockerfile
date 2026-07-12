FROM node:20-alpine

WORKDIR /app

# openssl cho Prisma, netcat cho healthcheck trong entrypoint
RUN apk add --no-cache openssl netcat-openbsd

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Cài toàn bộ deps (bao gồm tsx, ts-node để chạy TypeScript trực tiếp)
RUN npm ci

# Sinh Prisma Client cho Linux/Alpine
RUN npx prisma generate

# Copy toàn bộ source code
COPY . .

# Copy và cấp quyền entrypoint
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["./docker-entrypoint.sh"]
