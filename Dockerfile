FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src/ src/
COPY scripts/ scripts/

RUN mkdir -p data auth/whatsapp

VOLUME ["/app/data", "/app/auth"]

CMD ["npx", "tsx", "src/index.ts"]
