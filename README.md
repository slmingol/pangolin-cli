# pangolin-cli

CLI tool for bulk-managing resources, targets, and health checks on a self-hosted [Pangolin](https://github.com/fosrl/pangolin) instance via the Integration API.

## Prerequisites

- Pangolin with the Integration API enabled (`flags.enable_integration_api: true` in `config.yml`)
- The Integration API routed externally (see [Pangolin docs](https://docs.pangolin.net/self-host/advanced/integration-api))
- An API key with the required permissions (Organization > API Keys in the dashboard)

## Setup

```bash
git clone <repo>
cd pangolin-cli
npm install
cp .env.example .env
```

Edit `.env`:

```env
PANGOLIN_URL=https://pangolin.your-domain.com
PANGOLIN_API_KEY=your-key-id.your-key-secret
PANGOLIN_ORG_ID=your-org-niceid
```

## Usage

### Interactive wizard (recommended)

```bash
make
# or
npx ts-node src/cli.ts
```

Walks you through resource selection, field changes, and health check configuration without needing to know any flags.

### Make targets

```bash
make export                                          # export all resources + targets to current.yaml
make list                                            # list all resources
make list ARGS="--filter '*App Service*'"               # filter by name glob
make update FILTER="*App Service*" SET="sso=false" ARGS="--dry-run"
make update FILTER="sso=true" SET="enabled=false"
make delete FILTER="*old*" ARGS="--dry-run"
make health CMD=enable ARGS="--all-resources --dry-run"
make health CMD=status RESOURCE=my-service
make run ARGS="targets list --resource media-server"
make run ARGS="targets retarget --resource my-service --ip 10.0.1.5 --port 6767 --dry-run"
```

### Direct CLI

```bash
npx ts-node src/cli.ts <command> [options]

Commands:
  export              Export all resources and targets to YAML or JSON
  resources list      List resources (--filter, --json)
  resources update    Bulk update resources (--filter, --set, --dry-run)
  resources delete    Bulk delete resources (--filter, --dry-run, --yes)
  targets list        List targets for a resource (--resource)
  targets retarget    Change IP/port on all targets of a resource
  targets update      Bulk update target fields (--set hcEnabled=true ...)
  targets delete      Delete a target by ID
  health list         List org-level health checks
  health enable       Enable HC on resource(s) (--resource or --all-resources)
  health disable      Disable HC on resource(s)
  health status       Show HC config for a resource's targets
```

## Docker

Build:

```bash
docker compose build
```

Interactive wizard:

```bash
docker compose run --rm pangolin-cli
```

Specific command:

```bash
docker compose run --rm pangolin-cli resources list
docker compose run --rm pangolin-cli export --output /out/current.yaml
```

Exports written to `/out` inside the container are saved to `./exports/` on the host.

## Health check notes

- `hcHostname` and `hcPort` are auto-set to the target's own IP and port if not specified — required by Pangolin to send HC config to the newt client
- Interval and timeout are in **seconds** (not ms)
- TCP health checks require only interval/timeout/thresholds; HTTP checks additionally require scheme, path, method, and expected status code

## Integration API setup (traefik)

Add to `config/traefik/dynamic_config.yml`:

```yaml
http:
  routers:
    integration-api-router:
      rule: "Host(`pangolin.your-domain.com`) && PathPrefix(`/v1`)"
      service: integration-api-service
      entryPoints:
        - websecure
      priority: 200
      tls:
        certResolver: letsencrypt

  services:
    integration-api-service:
      loadBalancer:
        servers:
          - url: "http://pangolin:3003"
```

Replace `3003` with your `server.integration_port` value if different.
