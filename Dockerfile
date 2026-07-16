FROM node:22-alpine

RUN corepack enable




WORKDIR /app

COPY package.json pnpm-lock.yaml* ./

# With the whitelist in package.json, this will now succeed
# Replace your current RUN pnpm install line with this
RUN pnpm install --no-frozen-lockfile

COPY . .

# Run build if needed
RUN pnpm run build

EXPOSE 3000
CMD ["node", "dist/server.js"]