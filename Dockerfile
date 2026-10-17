FROM node:22-alpine
WORKDIR /app
ENV TZ=Asia/Shanghai NODE_ENV=production DATA_DIR=/data
RUN apk add --no-cache tzdata
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js ./
COPY public ./public
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
