# Build context: sites/ (the console reuses the public site's styles).
#   docker build -f moqom-admin/Dockerfile \
#     --build-arg MOQOM_ADMIN_GOOGLE_CLIENT_ID=... --build-arg MOQOM_ADMIN_API=https://api.moqom.cloud .
FROM node:22-alpine AS build
ARG MOQOM_ADMIN_API=https://api.moqom.cloud
ARG MOQOM_ADMIN_GOOGLE_CLIENT_ID
ARG MOQOM_ADMIN_HOSTED_DOMAIN=moqom.cloud
WORKDIR /sites
COPY _shared/glass ./_shared/glass
COPY moqom-cloud/src/styles ./moqom-cloud/src/styles
COPY moqom-cloud/public/favicon.svg ./moqom-cloud/public/favicon.svg
COPY moqom-admin ./moqom-admin
RUN cd moqom-admin && rm -rf dist && \
    MOQOM_ADMIN_API="$MOQOM_ADMIN_API" \
    MOQOM_ADMIN_GOOGLE_CLIENT_ID="$MOQOM_ADMIN_GOOGLE_CLIENT_ID" \
    MOQOM_ADMIN_HOSTED_DOMAIN="$MOQOM_ADMIN_HOSTED_DOMAIN" \
    node build.mjs

FROM nginx:1.27-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY moqom-admin/nginx.conf /etc/nginx/conf.d/admin.conf
COPY --from=build /sites/moqom-admin/dist /usr/share/nginx/html
EXPOSE 8080
