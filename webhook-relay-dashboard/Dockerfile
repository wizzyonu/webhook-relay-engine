# webhook-relay-dashboard/Dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# 🛡️ HARDENED NPM INSTALL: 
# 1. Clean cache to prevent TAR_ENTRY_ERROR from previous failed runs
# 2. Increase network timeout to 100 seconds to survive Docker Desktop hiccups
# 3. Disable audit/fund to reduce network overhead
RUN npm cache clean --force && \
    npm ci --no-audit --no-fund --network-timeout 100000

# Copy source code and build the production bundle
COPY . .
RUN npm run build

# Stage 2: Production Runtime (Nginx)
FROM nginx:alpine AS production

# Remove default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom, optimized nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built frontend assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check for the frontend
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]