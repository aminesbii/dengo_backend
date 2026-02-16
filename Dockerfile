FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies (use package-lock if present)
COPY package*.json ./

# Install only production dependencies for smaller image; change to `npm install` if you need dev deps
ENV NODE_ENV=production
RUN npm ci --only=production

# Ensure the runtime PORT matches the app default
ENV PORT=5000

# Copy source
COPY . .

# Expose application port (should match ENV.PORT)
EXPOSE 5000

# Default command
CMD ["node", "src/server.js"]
