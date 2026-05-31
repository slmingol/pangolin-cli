CLI := npx ts-node src/cli.ts

.DEFAULT_GOAL := interactive

.PHONY: build install interactive export list filters update delete health run \
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

run:
	$(CLI) $(ARGS)

docker-build:
	docker compose build

docker-interactive:
	docker compose run --rm pangolin-cli

docker-run:
	docker compose run --rm pangolin-cli $(ARGS)
