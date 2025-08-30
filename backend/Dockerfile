# Use Bun's official Docker image
FROM oven/bun:1-alpine

# Set working directory
WORKDIR /app

# Copy package.json and bun.lockb (if it exists)
COPY package.json ./
COPY bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Create a non-root user for security (bun user already exists in base image)
RUN addgroup -g 1001 -S nodejs || true
RUN chown -R bun:bun /app
USER bun

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun run healthcheck || exit 1

# Start the application
CMD ["bun", "run", "start"]
