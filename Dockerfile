FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate \
    && npx playwright install --with-deps chromium \
    && npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
