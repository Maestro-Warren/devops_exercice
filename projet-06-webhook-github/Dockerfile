FROM node:20-alpine as deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
COPY --from=deps /app/node_modules/ ./node_modules
COPY server.js .
COPY test.js .
ARG APP_VERSION=0.0.0
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=prodection
EXPOSE 3000
RUN addgroup -S devs_group && adduser -S -D -G devs_group warren_user
USER warren_user
CMD ["node", "server.js" ]



