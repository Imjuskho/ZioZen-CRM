FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --workspace=api
COPY . .
RUN npm run build --workspace=api

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
