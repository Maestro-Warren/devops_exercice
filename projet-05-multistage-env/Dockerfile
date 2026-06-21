FROM node:20-alpine as deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules 
COPY sever.js .
COPY test.js .
ARG APP_VERSION=1.0.0
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "server.js"]