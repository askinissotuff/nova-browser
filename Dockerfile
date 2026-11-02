FROM node:22-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY proxy/package.json ./package.json
RUN npm install --omit=dev
COPY index.html browser-engine.js sw.js icon.svg manifest.webmanifest ./public/
COPY proxy/server.mjs ./server.mjs
EXPOSE 8080
CMD ["node", "server.mjs"]
