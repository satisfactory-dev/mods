install:
	@npm install

build:
	@echo 'building from ./tsconfig.app.json'
	@./node_modules/.bin/tsc --project ./tsconfig.app.json

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
	@node ./populate-index.ts

build--web:
	@git clean -fxd ./dist/*.js ./dist/vendor/
	@mkdir -p ./dist/api/
	@rsync -avh --delete ./.cache/api/getMods/ ./dist/api/getMods/
	@rsync -avh --delete ./.cache/api/getUser-reduced/ ./dist/api/getUser-reduced/
	@./node_modules/.bin/rolldown --config rolldown.config.ts
	@node ./populate-html.ts
