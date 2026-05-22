FROM node:20-slim
WORKDIR /app
RUN npm init -y && npm install @anthropic-ai/sdk
COPY server-standalone.js ./
EXPOSE 3000
CMD ["node", "server-standalone.js"]
