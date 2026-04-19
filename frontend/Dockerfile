# Stage 1: Build the React/Vite app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .

# ── Temporary Hackathon Fix, not Standard Practice ──
RUN echo "VITE_API_BASE_URL=https://agentbanjir-backend-smiqlnpeia-as.a.run.app" > .env.production
RUN echo "VITE_POLL_INTERVAL_MS=5000" >> .env.production

RUN npm run build

# Stage 2: Serve the app
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist

# Cloud Run defaults to port 8080
EXPOSE 8080
CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:8080"]