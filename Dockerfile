FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

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

# Cloud Run uses PORT environment variable
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:8080/', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the application
CMD ["node", ".output/server/index.mjs"]
