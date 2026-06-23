FROM node:20-alpine as deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules/ ./node_modules/
COPY server.js .
ARG APP_VERSION = 0.0.0
ENV APP_VERSION=${APP_VERSION}
EXPOSE 3000
RUN addgroup -S devops && adduser -S -D -G devops warren
USER warren
 CMD ["node", "server.js"]