install:
	@npm install

lint--tsc:
	@echo 'running syntax check'
	@./node_modules/.bin/tsc --project ./tsconfig.app-check.json

lint--prettier:
	@echo 'running prettier'
	@./node_modules/.bin/prettier . --check

lint--oxlint:
	@./node_modules/.bin/oxlint

lint: lint--prettier lint--tsc lint--oxlint

ci--basic-checks:
	./node_modules/.bin/tsc --project ./tsconfig.app-check.json
	./node_modules/.bin/prettier . --check
	./node_modules/.bin/oxlint

.PHONY: tests
tests:
	@node --test

.PHONY: coverage
coverage: lint coverage--skip-lint

coverage--skip-lint:
	@node --experimental-test-coverage --test-coverage-include='${PWD}/src/**/*.ts' --test

coverage--lcov:
	@node --experimental-test-coverage --test-coverage-include='${PWD}/src/**/*.ts' --test --test-reporter=lcov --test-reporter-destination=coverage/lcov.info

build: build--cache build--index build--web

build--cache:
	@node ./populate-cache.ts

build--index:
	@mkdir -p ./.cache/mod-ids/
	@rm -f ./.cache/mod-ids/*.json
	@node ./populate-index.ts

build--schema:
	@rm -f ./.cache/*.validator.ts
	@node ./populate-schema.ts
	@-./node_modules/.bin/oxlint --fix ./.cache/*.validator.ts
	@-./node_modules/.bin/oxlint --fix ./.cache/*.validator.ts
	@-./node_modules/.bin/oxlint --fix ./.cache/*.validator.ts

build--web:
	@rm -f ./dist/*.js ./dist/vendor/
	@mkdir -p ./dist/api/
	@mkdir -p ./dist/mod-ids/
	@rsync -avh --delete ./.cache/api/getMod--reduced/ ./dist/api/getMod--reduced/
	@rsync -avh --delete ./.cache/mod-ids/ ./dist/mod-ids/
	@./node_modules/.bin/rolldown --config rolldown.config.ts
	@node ./populate-html.ts
