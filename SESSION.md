# Session Notes

Last updated: 2026-05-30

## What was built

Full interactive CLI for bulk-managing a self-hosted Pangolin instance via the Integration API.

### Features

- **Interactive wizard** (`make`) — guided TUI for all operations
- **Custom checkbox** — space toggles + auto-advances, `a`=all, `i`=invert, scrolling
- **Export** — dump all resources + targets to YAML or JSON (`make export`)
- **Bulk resource update** — SSO, blockAccess, enabled, stickySession, maintenanceModeEnabled
- **Bulk target update** — IP, port, enabled, health check config
- **Bulk delete** — with dry-run and type-to-confirm guard
- **Health check config** — HTTP (scheme/path/method/status/thresholds) + TCP modes
- **Per-target enable/disable** — checkbox picker per resource showing site names
- **Live dashboard** — polls `hcHealth` every 10s, `q`=quit `r`=refresh (`make dashboard`)
- **Makefile** — `make`, `make list`, `make update`, `make dashboard`, etc.
- **Docker** — multi-stage Dockerfile + compose.yaml with tty for interactive mode

## Instance details

- URL: https://pangolin.svcs.lamolabs.com
- Integration API: https://pangolin.svcs.lamolabs.com/v1
- Org: `lâmôlabs`
- API key in `.env` (gitignored)
- 92 resources across 4 tunnel sites

## Critical API findings

- Integration API disabled by default — needs `flags.enable_integration_api: true` in `config.yml`
- Traefik router needs `priority: 200` — `next-router`'s `!PathPrefix` negation beats integration router on rule-length heuristic otherwise
- Pagination: `page`/`pageSize` params (not `limit`/`offset`), 20 per page default
- Target updates: `siteId`, `ip`, `port` are required even for partial updates (400 otherwise)
- HC fields: `hcHostname` + `hcPort` required — Pangolin skips sending HC to newt client if missing
- HC units: interval/timeout in **seconds** (newt expects seconds, not ms)
- `hcHealth` on target response is live status from newt: `healthy`/`unhealthy`/`unknown`

## Known state

- `traefik-dashbd`: hostname `gerbil:8080` is internal docker — HC always `unknown`, expected
- `jellyfinbr3`: was unhealthy, disabled by user
- Each resource has 4 targets (one per tunnel site) — intentional redundancy, not duplicates
- Backend internal DNS pattern: `<service>.bub.lan`

## Unresolved / future ideas

- Export-as-blueprint (no native Pangolin feature yet — GH issue #1496 open)
- Terraform provider (`stackopshq/terraform-provider-pangolin`) if IaC needed
- Dashboard could add filtering (show only unhealthy, show by site)
