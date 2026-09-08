FROM node:22.19.0-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace @etd/backend --include-workspace-root=false
COPY backend backend
RUN npm run build --workspace @etd/backend

FROM node:22.19.0-bookworm-slim AS runtime
ENV NODE_ENV=sandbox
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev --workspace @etd/backend --include-workspace-root=false && npm cache clean --force
COPY --from=build /workspace/backend/dist backend/dist
COPY backend/src/db/migrations backend/dist/db/migrations
COPY fixtures fixtures
USER node
EXPOSE 8080
CMD ["node", "backend/dist/server.js"]
