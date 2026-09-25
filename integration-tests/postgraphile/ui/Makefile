SHELL := /bin/sh

.PHONY: install dev build start stop

install:
	npm install

dev:
	envdir env-dir npm run dev

build:
	envdir env-dir npm run build

start:
	envdir env-dir npm run dev & echo $$! > .ui.pid
	@echo "ui started (pid `cat .ui.pid`)"

stop:
	@if [ -f .ui.pid ]; then \
		kill "`cat .ui.pid`" 2>/dev/null || true; \
		rm -f .ui.pid; \
		echo "ui stopped"; \
	else \
		echo "ui not running"; \
	fi
