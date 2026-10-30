# TC Macro public gateway for Sliplane (one public HTTP port).
FROM caddy:2.10-alpine
COPY Caddyfile /etc/caddy/Caddyfile
ENV PORT=8080
EXPOSE 8080
# Sliplane healthcheck path: /health
