CLI     := npx ts-node src/cli.ts
DOCKER  := $(shell command -v podman 2>/dev/null || command -v docker 2>/dev/null)
COMPOSE := $(DOCKER) compose
# PROD=1 → use ghcr image only (no build fallback, always pull fresh)
# default → prefer ghcr if present, build locally if missing
COMPOSE_FILES := $(if $(PROD),-f compose.yaml,)

.DEFAULT_GOAL := help

.PHONY: help build install interactive export filters list update delete health dashboard run \
        docker-build docker-run docker-interactive

##@ General

help: ## Show this help
	@awk 'BEGIN { \
	  FS = ":.*##"; \
	  printf "\n\033[1mPangolin CLI\033[0m  —  bulk-manage Pangolin resources via the Integration API\n"; \
	  printf "\n\033[1mUsage:\033[0m  make \033[36m<target>\033[0m  [\033[33mVAR\033[0m=value ...]\n" \
	} \
	/^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 } \
	/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' Makefile

##@ Build

build: ## Compile TypeScript to dist/
	@printf "\033[36m→\033[0m Building TypeScript...\n"
	@npm run build

install: build ## Build and link pangolin-cli globally
	@printf "\033[36m→\033[0m Linking pangolin-cli globally...\n"
	@npm link

##@ CLI

interactive: ## Launch interactive TUI wizard
	$(CLI)

export: ## Export resources + targets to current.yaml  (ARGS=...)
	@printf "\033[36m→\033[0m Exporting to current.yaml...\n"
	@$(CLI) export --output current.yaml $(ARGS)

filters: ## Tabular view: name, niceId, sso, enabled
	@$(CLI) resources list --json 2>/dev/null | \
	  node -e "const r=require('fs').readFileSync('/dev/stdin','utf8'); \
	    JSON.parse(r).forEach(x => console.log( \
	      x.name.padEnd(40) + x.niceId.padEnd(45) + \
	      'sso=' + (x.sso?'true ':'false') + ' ' + \
	      'enabled=' + (x.enabled===false?'false':'true') \
	    ))"

list: ## List resources  (ARGS='--filter *name*')
	@$(CLI) resources list $(ARGS)

update: ## Bulk update resources  (FILTER=glob SET=field=val ARGS=--dry-run)
	@$(CLI) resources update --filter "$(FILTER)" --set $(SET) $(ARGS)

delete: ## Bulk delete resources  (FILTER=glob ARGS=--dry-run)
	@$(CLI) resources delete --filter "$(FILTER)" $(ARGS)

health: ## Health checks  (CMD=enable|disable|status RESOURCE=name)
	@$(CLI) health $(CMD) $(if $(RESOURCE),--resource "$(RESOURCE)",--all-resources) $(ARGS)

dashboard: ## Live health status dashboard  (q=quit  r=refresh)
	$(CLI) dashboard

run: ## Run any CLI subcommand  (ARGS='targets list --resource foo')
	$(CLI) $(ARGS)

##@ Docker

docker-build: ## Build container image locally
	@printf "\033[36m→\033[0m Building container image...\n"
	@PODMAN_COMPOSE_WARNING_LOGS=false $(COMPOSE) $(COMPOSE_FILES) build

docker-interactive: ## Run interactive wizard in container  (PROD=1 for ghcr-only)
	@PODMAN_COMPOSE_WARNING_LOGS=false $(COMPOSE) $(COMPOSE_FILES) --progress quiet run --rm pangolin-cli

docker-run: ## Run CLI subcommand in container  (ARGS='resources list')
	@PODMAN_COMPOSE_WARNING_LOGS=false $(COMPOSE) $(COMPOSE_FILES) --progress quiet run --rm pangolin-cli $(ARGS)
