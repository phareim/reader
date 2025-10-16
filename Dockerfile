FROM node:20-alpine

WORKDIR /app

# Install dependencies (including dev dependencies for build)
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p /app/data && chmod 777 /app/data

# Expose port
EXPOSE 8080

# Cloud Run provides PORT environment variable dynamically
# Nuxt will use it via HOST and PORT env vars
ENV HOST=0.0.0.0
ENV PORT=8080

# Start the application
# Cloud Run will override PORT at runtime
CMD ["sh", "-c", "node .output/server/index.mjs"]
