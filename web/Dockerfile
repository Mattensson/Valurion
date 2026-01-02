FROM node:20-alpine

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Expose the listening port
EXPOSE 3000

# Run the development server
CMD ["npm", "run", "dev"]
