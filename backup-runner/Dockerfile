FROM alpine:3.20

RUN apk add --no-cache \
    bash \
    ca-certificates \
    coreutils \
    cronie \
    curl \
    jq \
    postgresql16-client \
    rclone \
    tzdata \
    tar \
    gzip \
    aws-cli

WORKDIR /app

COPY entrypoint.sh /entrypoint.sh
COPY run-backup.sh /run-backup.sh
RUN chmod +x /entrypoint.sh /run-backup.sh

ENTRYPOINT ["/entrypoint.sh"]
