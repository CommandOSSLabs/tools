# Seal Key Server image packaging MystenLabs release binaries.
# Upstream: https://github.com/MystenLabs/seal/releases
#
# Build:
#   docker build --build-arg VERSION=$(cat .current-version) -t seal-key-server .
#
# Multi-arch (buildx):
#   docker buildx build --platform linux/amd64,linux/arm64 \
#     --build-arg VERSION=$(cat .current-version) -t seal-key-server .

ARG VERSION=0.6.11

FROM debian:bookworm-slim AS downloader
ARG VERSION
ARG TARGETARCH

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# Release assets: key-server-linux-x86_64 | key-server-linux-aarch64
# Tag format: seal-v${VERSION}
RUN set -eux; \
  case "${TARGETARCH}" in \
    amd64) arch="x86_64" ;; \
    arm64) arch="aarch64" ;; \
    *) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
  esac; \
  url="https://github.com/MystenLabs/seal/releases/download/seal-v${VERSION}/key-server-linux-${arch}"; \
  echo "Downloading ${url}"; \
  curl -fsSL -o /key-server "${url}"; \
  chmod +x /key-server

FROM debian:bookworm-slim
ARG VERSION

LABEL org.opencontainers.image.title="CommandOSS Seal Key Server" \
  org.opencontainers.image.description="Seal key server packaged from MystenLabs release binaries" \
  org.opencontainers.image.version="${VERSION}" \
  org.opencontainers.image.source="https://github.com/CommandOSSLabs/tools" \
  org.opencontainers.image.url="https://github.com/CommandOSSLabs/tools" \
  org.opencontainers.image.vendor="CommandOSSLabs" \
  org.opencontainers.image.authors="CommandOSSLabs" \
  org.opencontainers.image.licenses="Apache-2.0"

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libssl3 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=downloader /key-server /opt/key-server/bin/key-server

# Application port (override with PORT env var; default 2024)
EXPOSE 2024
# Prometheus metrics (default metrics_host_port 9184)
EXPOSE 9184

ENTRYPOINT ["/opt/key-server/bin/key-server"]
