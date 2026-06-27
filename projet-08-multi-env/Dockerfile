FROM node:20-alpine as deps 
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules/ ./node_modules/
COPY server.js .
ARG APP_VERSION=0.0.0
ENV APP_VERSION=${APP_VERSION}
EXPOSE 3000
USER node
CMD ["node", "server.js"]

