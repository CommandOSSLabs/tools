ARG TARGETPLATFORM
ARG VERSION

FROM --platform=linux/amd64 mysten/walrus-upload-relay:main-v${VERSION} AS base-amd64
FROM --platform=linux/arm64 mysten/walrus-upload-relay:main-arm64-v${VERSION} AS base-arm64

FROM base-${TARGETPLATFORM#linux/} AS final
ARG VERSION

LABEL org.opencontainers.image.title="CommandOSS Walrus Upload Relay" \
  org.opencontainers.image.description="Configurable Walrus upload relay image" \
  org.opencontainers.image.version="${VERSION}" \
  org.opencontainers.image.source="https://github.com/CommandOSSLabs/tools" \
  org.opencontainers.image.url="https://github.com/CommandOSSLabs/tools" \
  org.opencontainers.image.vendor="CommandOSSLabs" \
  org.opencontainers.image.authors="CommandOSSLabs" \
  org.opencontainers.image.licenses="Apache-2.0"

COPY --from=hairyhenderson/gomplate:stable /gomplate /bin/gomplate
COPY ./templates /templates
COPY --chmod=755 ./scripts/entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
