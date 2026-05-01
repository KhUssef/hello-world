# Use official Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy dependency files first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source
COPY . .

# Run tests during build (optional but good for CI/CD)
RUN npm test || true

# Expose app port (change if your app uses another port)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
