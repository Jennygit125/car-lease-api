# Use a specific Node version
FROM node:22-alpine
ENV PNPM_ONLY_BUILT_DEPENDENCIES="bcrypt,esbuild,@scarf/scarf"
# Install pnpm via npm to bypass corepack network instability
RUN npm install -g pnpm

# Set the working directory
WORKDIR /app

# Copy dependency files first to leverage Docker layer caching
COPY package.json pnpm-lock.yaml* .npmrc* ./

# Install dependencies
# Using --unsafe-perm because of the native modules like bcrypt
RUN pnpm install --no-frozen-lockfile

# Copy the rest of your application code
COPY . .

# Build the project (if you have a build step in package.json)
RUN pnpm run build

# Expose the app port
EXPOSE 3000

# Start the application
CMD ["node", "dist/server.js"]