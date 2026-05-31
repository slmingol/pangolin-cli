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

#### Main menu

```
Pangolin CLI

? What do you want to do?
❯ Export current config to YAML
  List resources
  Update resources
  Delete resources
  Manage health checks
  Manage targets
  Live health status dashboard
  ──────────────────
  Exit
```

#### Resource selection

Space toggles and auto-advances to the next item. `a` selects all, `i` inverts selection.

```
? Select resources to update:
  (space=toggle+next, a=all, i=invert, enter=confirm)
 ◉ ❯ App Service 01                               sso
 ◉   App Service 02                               sso
 ◉   App Service 03                               sso
 ◯   App Service 04                               sso
 ◯   App Service 05                               sso
 ◯   App Service 06                               sso
 ◯   media-server                           sso
 ◯   my-service                                   sso
  (1-20 of 92)
```

#### Update menu

```
? What do you want to change?
  ── Resource settings ──
❯ SSO / Authentication
  Block access
  Enabled / Disabled
  Sticky session
  Maintenance mode
  ── Target settings ──
  Backend IP address
  Backend port
  Target enabled / disabled
  Health check configuration
```

#### Health check configuration

```
? Enable health checks? Yes
? Check type:
❯ HTTP / HTTPS
  TCP

? Interval (seconds): 10
? Timeout (seconds): 5
? Healthy after N successes: 2
? Unhealthy after N failures: 3
? Scheme: http
? Path: /health
? Method: GET
? Expected status code: 200
? Follow redirects? No

Will update targets on 6 resource(s):
  App Service 01
  App Service 02
  ...
? Apply changes? (y/N)
```

#### Health checks menu

```
? Health check action:
❯ View status on a resource
  ──────────────────────────
  Configure & enable on selected resources
  Configure & enable on ALL resources
  ──────────────────────────
  Disable on selected resources
  Disable on ALL resources
```

#### Manage targets

Per-resource target management: view, enable/disable individual targets, or change IP/port on a specific target.

```
? Which resource? App Service 01
? What do you want to do?
❯ View targets
  Enable / disable specific targets
  Change IP / port on a target
```

Selecting **Enable / disable specific targets** shows a checkbox list with each target's current site and enabled state:

```
? Select targets to toggle:
  (space=toggle+next, a=all, i=invert, enter=confirm)
 ◉ ❯ app-service-01.example.lan:80   My-Org Svcs #1 (docker-host-01)  enabled
 ◯   app-service-01.example.lan:80   My-Org Svcs #2 (rockpi-4cplus)    enabled
 ◯   app-service-01.example.lan:80   My-Org Svcs #3 (orangepi5)        enabled
 ◯   app-service-01.example.lan:80   My-Org Svcs #4 (docker-host-03)  enabled
```

#### Live health status dashboard

Polls `hcHealth` from the API every 10 seconds. Shows all enabled targets with active health checks. `q` to quit, `r` to refresh immediately.

```
Pangolin — Live Health Status   updated 9:32:16 PM   q=quit r=refresh
────────────────────────────────────────────────────────────────────────────────
  App Service 01
    ● healthy    app-service-01.example.lan:80          tcp
  App Service 02
    ● healthy    app-service-02.example.lan:80          tcp
  media-server
    ● healthy    media-server.example.lan:13378   tcp
  my-service
    ● unhealthy  my-service.example.lan:8096       tcp
  traefik-dashbd
    ● unknown    gerbil:8080                    tcp
────────────────────────────────────────────────────────────────────────────────
86 healthy  1 unhealthy  1 unknown
```

> **Note:** Targets with an internal hostname (e.g. `gerbil:8080`) will remain `unknown` — newt cannot reach them via TCP from outside the Docker network.

### Make targets

```bash
make export                                          # export all resources + targets to current.yaml
make filters                                         # tabular view: name, niceId, sso, enabled
make list                                            # list all resources
make list ARGS="--filter '*App Service*'"               # filter by name glob
make update FILTER="*App Service*" SET="sso=false" ARGS="--dry-run"
make update FILTER="sso=true" SET="enabled=false"
make delete FILTER="*old*" ARGS="--dry-run"
make health CMD=enable ARGS="--all-resources --dry-run"
make health CMD=status RESOURCE=my-service
make dashboard                                       # live health status (polls every 10s)
make docker-interactive                              # interactive wizard inside container
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
  dashboard           Live health status dashboard (polls every 10s, q=quit r=refresh)
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
- `hcHealth` on the target API response is live status reported by the newt client: `healthy`, `unhealthy`, or `unknown`
- Targets with internal Docker hostnames (e.g. `gerbil:8080`) will always show `unknown` — newt can't reach them via TCP from outside the network

## API notes

- Target update calls require `siteId`, `ip`, and `port` as base fields even for partial updates — omitting them returns HTTP 400
- Pagination uses `page`/`pageSize` query params (not `limit`/`offset`); default page size is 20
- Org `niceId` values with unicode characters must be URL-encoded in API paths (e.g. `my-org` → `l%C3%A2m%C3%B4labs`)
- Resources have one target per tunnel site for redundancy — multiple targets with the same backend IP:port is expected, not a misconfiguration

## Integration API setup (traefik)

Enable the Integration API in `config/config.yml`:

```yaml
flags:
  enable_integration_api: true

server:
  integration_port: 3003
```

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

> **`priority: 200` is required.** Without it, Traefik's rule-length heuristic causes the existing `next-router` (which uses a `!PathPrefix` negation) to win over the integration router for `/v1/` paths.

Replace `3003` with your `server.integration_port` value if different.

## Future ideas

- Export current config as Pangolin blueprint YAML (no native support yet — [GH issue #1496](https://github.com/fosrl/pangolin/issues/1496))
- Terraform provider alternative: [stackopshq/terraform-provider-pangolin](https://github.com/stackopshq/terraform-provider-pangolin)
- Dashboard filtering — show only unhealthy, filter by site
