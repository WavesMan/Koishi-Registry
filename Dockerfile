FROM node:20-alpine

# ARG https_proxy http://192.168.1.100:7890
# ARG http_proxy http://192.168.1.100:7890

COPY . /app

WORKDIR /app

RUN npm install -g corepack \
  && corepack enable \
  && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile=false
RUN pnpm build

EXPOSE 3000
CMD ["node", "dist/index.js" ,"--server"]
