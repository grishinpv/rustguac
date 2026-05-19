FROM node:22-bookworm-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN node node_modules/vite/bin/vite.js build --outDir /web --emptyOutDir

FROM nginx:1.27-alpine

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /web/ /usr/share/nginx/html/

ENV RUSTGUAC_BACKEND_URL=http://rustguac:8089

EXPOSE 80
