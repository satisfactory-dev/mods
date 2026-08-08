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

build: build--schema build--cache build--index build--web

build--cache:
	@node ./populate-cache.ts

build--index:
	@mkdir -p ./.cache/data/mod-ids/
	@mkdir -p ./.cache/data/lunr/
	@rm -f ./.cache/mod-ids/*.json
	@rm -f ./.cache/data/mod-ids/*.json
	@rm -f ./.cache/data/lunr/*.js
	@rm -f ./.cache/lunr/*.js
	@node ./populate-index.ts

build--schema:
	@rm -f ./.cache/*.validator.ts
	@rm -f ./.cache/data/*/*.json
	@node ./populate-schema.ts
	@-./node_modules/.bin/oxlint --fix ./.cache/*.validator.ts
	@-./node_modules/.bin/oxlint --fix ./.cache/*.validator.ts
	@-./node_modules/.bin/oxlint --fix ./.cache/*.validator.ts

build--css:
	@node ./build-css.ts

build--web: build--css
	@rm -f ./dist/js/*.js ./dist/*.json
	@mkdir -p ./dist/api/
	@mkdir -p ./dist/data/
	@mkdir -p ./dist/css/
	@rsync -avh --delete ./.cache/api/getMod--reduced/ ./dist/api/getMod--reduced/
	@rsync -avh --delete ./.cache/data/ ./dist/data/
	@./node_modules/.bin/rolldown --config rolldown.config.ts
	@node ./populate-html.ts
