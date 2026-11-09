# Official Node image, immutable multi-platform digest; build for linux/amd64.
FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node scripts/staging-push-worker.mjs scripts/push-cloud-service.mjs ./scripts/
COPY --chown=node:node lib/stagingEnvironment.mjs lib/vapid.mjs ./lib/
USER node
ENTRYPOINT ["node", "scripts/push-cloud-service.mjs"]
