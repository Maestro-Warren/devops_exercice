FROM node:20-alpine
WORKDIR /app 
COPY package*.json ./
RUN npm ci --only=production
COPY server.js .
RUN addgroup -S appgroup && adduser appuser -G appgroup
USER appuser
EXPOSE 3000
CMD ['node', 'server.js']