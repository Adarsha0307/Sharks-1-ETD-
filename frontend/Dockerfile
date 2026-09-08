FROM node:22.19.0-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace @etd/frontend --include-workspace-root=false
COPY frontend frontend
RUN npm run build --workspace @etd/frontend

FROM nginxinc/nginx-unprivileged:1.27.5-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/frontend/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
