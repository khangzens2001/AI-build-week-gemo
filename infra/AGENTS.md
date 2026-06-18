# infra — local dev (Podman)

**Responsibility:** local Chroma server + reproducible dev environment.

- **Local only** — not a deploy artifact. Vercel builds from source; the Worker deploys via `wrangler`. Do not wire Podman into the deploy flow.
- Chroma: `podman run -d --name chroma -p 8000:8000 docker.io/chromadb/chroma:latest`
- Full local stack: `podman-compose -f infra/podman-compose.yml up`
- Use Podman (rootless), not Docker, per project choice — commands are otherwise Docker-compatible.
