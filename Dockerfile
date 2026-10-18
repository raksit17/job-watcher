FROM node:22-bookworm-slim

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Cache dependencies and Chromium until package files change.
COPY package*.json ./
RUN npm ci \
    && npx playwright install --with-deps chromium

COPY . .

# Prisma config requires a URL for generation; no database connection is made.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
    && npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
