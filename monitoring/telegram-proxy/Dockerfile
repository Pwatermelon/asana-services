FROM ghcr.io/sagernet/sing-box:v1.11.5

RUN apk add --no-cache python3

COPY vless_to_singbox.py entrypoint.sh /opt/telegram-proxy/
RUN chmod +x /opt/telegram-proxy/entrypoint.sh

ENV TELEGRAM_PROXY_PORT=8888

ENTRYPOINT ["/bin/sh", "/opt/telegram-proxy/entrypoint.sh"]
