CLI := npx ts-node src/cli.ts
DOCKER := $(shell command -v podman 2>/dev/null || command -v docker 2>/dev/null)
COMPOSE := $(DOCKER) compose
# PROD=1 → use ghcr image only (no build fallback, always pull fresh)
# default → prefer ghcr if present, build locally if missing
COMPOSE_FILES := $(if $(PROD),-f compose.yaml,)

.DEFAULT_GOAL := help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' Makefile | \
	  awk -F'##' '{gsub(/:.*/, "", $$1); printf "  %-22s %s\n", $$1, $$2}' | sort

.PHONY: build install interactive export list filters update delete health dashboard run \
        docker-build docker-run docker-interactive help

build: ## Compile TypeScript to dist/
	npm run build

install: build ## Build and link pangolin-cli globally
	npm link

interactive: ## Launch interactive TUI wizard
	$(CLI)

export: ## Export all resources + targets to current.yaml (ARGS=...)
	$(CLI) export --output current.yaml $(ARGS)

filters: ## Tabular view: name, niceId, sso, enabled
	@$(CLI) resources list --json 2>/dev/null | \
	  node -e "const r=require('fs').readFileSync('/dev/stdin','utf8'); \
	    JSON.parse(r).forEach(x => console.log( \
	      x.name.padEnd(40) + x.niceId.padEnd(45) + \
	      'sso=' + (x.sso?'true ':'false') + ' ' + \
	      'enabled=' + (x.enabled===false?'false':'true') \
	    ))"

list: ## List resources (ARGS=--filter '*name*')
	$(CLI) resources list $(ARGS)

update: ## Bulk update resources (FILTER=glob SET=field=value ARGS=--dry-run)
	$(CLI) resources update --filter "$(FILTER)" --set $(SET) $(ARGS)

delete: ## Bulk delete resources (FILTER=glob ARGS=--dry-run)
	$(CLI) resources delete --filter "$(FILTER)" $(ARGS)

health: ## Manage health checks (CMD=enable|disable|status RESOURCE=name)
	$(CLI) health $(CMD) $(if $(RESOURCE),--resource "$(RESOURCE)",--all-resources) $(ARGS)

dashboard: ## Live health status dashboard (polls every 10s, q=quit r=refresh)
	$(CLI) dashboard

run: ## Run any CLI subcommand directly (ARGS='targets list --resource foo')
	$(CLI) $(ARGS)

docker-build: ## Build container image locally
	@PODMAN_COMPOSE_WARNING_LOGS=false $(COMPOSE) $(COMPOSE_FILES) build

docker-interactive: ## Run interactive wizard in container (PROD=1 for ghcr-only)
	@PODMAN_COMPOSE_WARNING_LOGS=false $(COMPOSE) $(COMPOSE_FILES) --progress quiet run --rm pangolin-cli

docker-run: ## Run CLI subcommand in container (ARGS='resources list')
	@PODMAN_COMPOSE_WARNING_LOGS=false $(COMPOSE) $(COMPOSE_FILES) --progress quiet run --rm pangolin-cli $(ARGS)
