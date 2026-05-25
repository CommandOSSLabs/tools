ARG VERSION=2023

FROM amazonlinux:${VERSION}
ARG VERSION

LABEL org.opencontainers.image.title="CommandOSS Nitro CLI" \
    org.opencontainers.image.description="Nitro CLI tooling image for enclave build workflows" \
    org.opencontainers.image.version="${VERSION}" \
    org.opencontainers.image.source="https://github.com/CommandOSSLabs/tools" \
    org.opencontainers.image.url="https://github.com/CommandOSSLabs/tools" \
    org.opencontainers.image.vendor="CommandOSSLabs" \
    org.opencontainers.image.authors="CommandOSSLabs" \
    org.opencontainers.image.licenses="Apache-2.0"

# Install Nitro CLI dependencies
RUN dnf install -y \
    aws-nitro-enclaves-cli \
    aws-nitro-enclaves-cli-devel \
    docker \
    gzip \
    tar

ENTRYPOINT [ "/usr/bin/nitro-cli" ]
