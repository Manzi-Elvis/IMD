# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Production stage ---
# Separate runtime stage so devDependencies (Nest CLI, TS compiler, test
# tooling) never end up in the shipped image — smaller image, smaller
# attack surface.
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# Uploaded evidence lives outside the image so it survives container
# restarts/redeploys when mounted as a volume (see docker-compose.yml).
RUN mkdir -p /app/uploads

EXPOSE 3000
CMD ["node", "dist/main"]
