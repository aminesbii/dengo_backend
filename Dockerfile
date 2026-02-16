FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies (use package-lock if present)
COPY package*.json ./

# Install only production dependencies for smaller image; change to `npm install` if you need dev deps
ENV NODE_ENV=production
RUN npm ci --only=production


# Copy source
COPY . .

# Ensure the runtime PORT matches the app default (Koyeb health check expects 8000)
ENV PORT=8000

# Expose application port (should match ENV.PORT)
EXPOSE 8000

# Default command
CMD ["node", "src/server.js"]
