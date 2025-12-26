FROM node:18-alpine

# 1️⃣ Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# 2️⃣ Change ownership
RUN chown -R appuser:appgroup /app

# 3️⃣ Switch user
USER appuser

EXPOSE 5000

# 4️⃣ Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "server.js"]
