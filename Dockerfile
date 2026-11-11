FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json index.html ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY src/game.ts src/actions.ts ./src/
COPY server ./server
EXPOSE 8080
CMD ["node", "--experimental-strip-types", "server/index.ts"]
