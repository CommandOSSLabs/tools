# Seal Key Server

Container image for the [MystenLabs Seal](https://github.com/MystenLabs/seal) key server.

This package downloads the official `key-server` release binary from
[MystenLabs/seal releases](https://github.com/MystenLabs/seal/releases) and packages it for
`linux/amd64` and `linux/arm64`.

## Upstream

- Source: [MystenLabs/seal](https://github.com/MystenLabs/seal)
- Releases: [github.com/MystenLabs/seal/releases](https://github.com/MystenLabs/seal/releases)
- Version pin: `.current-version` maps to release tag `seal-v${VERSION}`
  - Binary assets: `key-server-linux-x86_64`, `key-server-linux-aarch64`

## Multi-Architecture Support

- `linux/amd64` (`x86_64`)
- `linux/arm64` (`aarch64`)

## Ports

| Port  | Purpose                          |
| ----- | -------------------------------- |
| `2024` | HTTP API (`PORT` env overrides) |
| `9184` | Prometheus metrics (default)    |

## Configuration

The binary supports two configuration modes:

### 1. Config file (recommended)

Set `CONFIG_PATH` to a YAML config file path (mount it into the container).

Example config reference:
[key-server-config.yaml](https://github.com/MystenLabs/seal/blob/main/crates/key-server/key-server-config.yaml)

```bash
docker run --rm \
  -p 2024:2024 \
  -e CONFIG_PATH=/config/key-server-config.yaml \
  -e MASTER_KEY=<your-master-key> \
  -v /path/to/key-server-config.yaml:/config/key-server-config.yaml:ro \
  cmdoss/seal-key-server:latest
```

Optional: set `NODE_URL` either in the config file **or** as an environment variable (not both).

### 2. Local env vars (testing only)

Without `CONFIG_PATH`, the server uses environment variables in **Open** mode:

| Variable               | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `MASTER_KEY`           | Master key material (required)                   |
| `KEY_SERVER_OBJECT_ID` | Onchain key server object ID (hex)               |
| `NETWORK`              | Network name (default: `Testnet`)                |
| `NODE_URL`             | Optional custom full node URL                    |
| `PORT`                 | HTTP listen port (default: `2024`)               |

## Build locally

```bash
cd packages/seal-key-server
docker build --build-arg VERSION="$(cat .current-version)" -t seal-key-server .
```

## License

This project is licensed under the Apache License 2.0.
The packaged `key-server` binary is from MystenLabs/seal (Apache-2.0).
