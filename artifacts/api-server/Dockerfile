FROM node:20-slim
WORKDIR /app
RUN npm install -g pnpm
COPY package.json ./
RUN echo '{"name":"workspace","version":"0.0.0","private":true}' > /tmp/root-package.json
RUN pnpm install --no-frozen-lockfile --ignore-workspace
COPY . .
EXPOSE 3000
CMD ["node", "dist/index.js"]