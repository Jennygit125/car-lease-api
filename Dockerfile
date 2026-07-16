FROM node:22-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml* .npmrc* ./

RUN pnpm install --no-frozen-lockfile || true
RUN pnpm approve-builds --all
RUN pnpm install --no-frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["node_modules/.bin/tsx", "src/server.ts"]
