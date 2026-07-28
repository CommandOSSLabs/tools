# CommandOSS Tools

Collection of Docker images and tools for CommandOSS projects.

## Available Docker Images

| **Tool**                       | **Version** | **Description**                                   |
| ------------------------------ | ----------- | ------------------------------------------------- |
| [`cmdoss/auth-proxy`]          | `1.0.0`     | OpenResty + Lua JWT authentication reverse proxy. |
| [`cmdoss/nitro-cli`]           | `2023.12.20260724.0` 👁️ | Containerized AWS Nitro Enclaves CLI.             |
| [`cmdoss/seal-key-server`]     | `0.6.11` 👁️ | Seal key server from MystenLabs release binaries. |
| [`cmdoss/walrus-upload-relay`] | `1.48.0` 👁️  | Walrus Upload Relay with extra features.          |

> [!NOTE]
> Images marked with 👁️ are automatically tracked against their upstream source (Docker Hub tags or GitHub releases). A scheduled workflow checks every 6 hours and bumps the version when a new upstream release is detected.


## License

This project is licensed under the Apache License 2.0.

<!-- Links -->
[`cmdoss/auth-proxy`]: https://hub.docker.com/r/cmdoss/auth-proxy
[`cmdoss/nitro-cli`]: https://hub.docker.com/r/cmdoss/nitro-cli
[`cmdoss/seal-key-server`]: https://hub.docker.com/r/cmdoss/seal-key-server
[`cmdoss/walrus-upload-relay`]: https://hub.docker.com/r/cmdoss/walrus-upload-relay

---

<p align="center">
  <strong>Built with ❤️ by the CommandOSS Team</strong>
</p>
