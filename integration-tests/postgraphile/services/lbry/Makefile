SHELL := /bin/sh

.PHONY: install api start stop

install:
	npm install

api:
	envdir env-dir node index.js

start:
	envdir env-dir node index.js & echo $$! > .api.pid
	@echo "api started (pid `cat .api.pid`)"

stop:
	@if [ -f .api.pid ]; then \
		kill "`cat .api.pid`" 2>/dev/null || true; \
		rm -f .api.pid; \
		echo "api stopped"; \
	else \
		echo "api not running"; \
	fi
