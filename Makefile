CLI := npx ts-node src/cli.ts
DOCKER := $(shell command -v podman 2>/dev/null || command -v docker 2>/dev/null)
COMPOSE := $(DOCKER) compose
# PROD=1 → use ghcr image only (no build fallback, always pull fresh)
# default → prefer ghcr if present, build locally if missing
COMPOSE_FILES := $(if $(PROD),-f compose.yaml,)

.DEFAULT_GOAL := help

help:
	@grep -E '^[a-zA-Z_-]+:' Makefile | grep -v '^\.PHONY' | \
	  awk -F: '{printf "  %-20s\n", $$1}' | sort

.PHONY: build install interactive export list filters update delete health dashboard run \
        docker-build docker-run docker-interactive

build:
	npm run build

install: build
	npm link

interactive:
	$(CLI)

export:
	$(CLI) export --output current.yaml $(ARGS)

filters:
	@$(CLI) resources list --json 2>/dev/null | \
	  node -e "const r=require('fs').readFileSync('/dev/stdin','utf8'); \
	    JSON.parse(r).forEach(x => console.log( \
	      x.name.padEnd(40) + x.niceId.padEnd(45) + \
	      'sso=' + (x.sso?'true ':'false') + ' ' + \
	      'enabled=' + (x.enabled===false?'false':'true') \
	    ))"

list:
	$(CLI) resources list $(ARGS)

update:
	$(CLI) resources update --filter "$(FILTER)" --set $(SET) $(ARGS)

delete:
	$(CLI) resources delete --filter "$(FILTER)" $(ARGS)

health:
	$(CLI) health $(CMD) $(if $(RESOURCE),--resource "$(RESOURCE)",--all-resources) $(ARGS)

dashboard:
	$(CLI) dashboard

run:
	$(CLI) $(ARGS)

docker-build:
	@PODMAN_COMPOSE_WARNING_LOGS=false $(COMPOSE) $(COMPOSE_FILES) build

docker-interactive:
	@PODMAN_COMPOSE_WARNING_LOGS=false $(COMPOSE) $(COMPOSE_FILES) --progress quiet run --rm pangolin-cli

docker-run:
	@PODMAN_COMPOSE_WARNING_LOGS=false $(COMPOSE) $(COMPOSE_FILES) --progress quiet run --rm pangolin-cli $(ARGS)
