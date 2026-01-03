FROM node:20-alpine

WORKDIR /app

# Install dependencies based on the preferred package manager
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose the listening port
EXPOSE 3000

# Run the development server
CMD ["npm", "run", "dev"]
