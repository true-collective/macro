# TC FusionAuth — secrets via env at runtime; never bake secret values into the image.
FROM fusionauth/fusionauth-app:1.62.1
COPY kickstart.template.json /opt/tc/kickstart.template.json
COPY entrypoint.sh /opt/tc/entrypoint.sh
USER root
# Ensure python3 for kickstart rendering (image base may vary).
RUN (command -v python3 >/dev/null \
      || (apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*) \
      || (microdnf install -y python3) \
      || (apk add --no-cache python3)) \
  && chmod +x /opt/tc/entrypoint.sh \
  && mkdir -p /usr/local/fusionauth/kickstart \
  && chown -R fusionauth:fusionauth /usr/local/fusionauth/kickstart /opt/tc
USER fusionauth
ENV FUSIONAUTH_APP_RUNTIME_MODE=production
ENV FUSIONAUTH_APP_MEMORY=512M
ENV FUSIONAUTH_APP_KICKSTART_FILE=/usr/local/fusionauth/kickstart/kickstart.json
ENTRYPOINT ["/opt/tc/entrypoint.sh"]
