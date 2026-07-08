FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy sources
COPY backend ./backend
COPY frontend ./frontend

# Generate Prisma client at build time
WORKDIR /app/backend
RUN npx prisma generate

# Ensure uploads dir exists at runtime
RUN mkdir -p /app/backend/uploads

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
