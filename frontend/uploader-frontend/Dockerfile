FROM node:18-alpine

# 1️⃣ Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 2️⃣ Fix permissions
RUN chown -R appuser:appgroup /app

# 3️⃣ Switch user
USER appuser

EXPOSE 3000

# 4️⃣ Healthcheck (React dev server)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["npm", "start"]
