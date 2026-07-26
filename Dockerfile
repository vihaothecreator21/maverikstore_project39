# ─────────────────────────────────────────────────────
# STAGE 1: Builder — Build Vite Frontend
# ─────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Cài đặt tất cả dependencies
RUN npm ci

# Copy toàn bộ source frontend
COPY . .

# Build Vite: src/ → dist/
RUN npm run build

# ─────────────────────────────────────────────────────
# STAGE 2: Nginx — Phục vụ static files
# ─────────────────────────────────────────────────────
FROM nginx:alpine

# Xóa cấu hình Nginx mặc định
RUN rm /etc/nginx/conf.d/default.conf

# Copy file cấu hình Nginx tùy chỉnh
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy kết quả build Vite vào thư mục phục vụ của Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
