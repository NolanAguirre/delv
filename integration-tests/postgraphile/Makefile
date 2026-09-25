SHELL := /bin/sh

.PHONY: help install \
        db.create db.deploy db.verify db.revert db.seed db.reset \
        api api.start api.stop ui.dev ui.build ui.start ui.stop \
        nginx nginx.stop start up down

help:
	@echo "lbry integration-test app"
	@echo ""
	@echo "Quick start: make install && make db.reset && make up"
	@echo "Day-to-day:   make start"
	@echo "Then open http://localhost:8060"
	@echo ""
	@echo "Available make commands:"
	@echo "  help         Show this help message"
	@echo "  install      npm deps for api + ui"
	@echo "  db.create    Create the database"
	@echo "  db.deploy    Deploy database migrations"
	@echo "  db.verify    Verify the database schema"
	@echo "  db.revert    Revert the latest migration"
	@echo "  db.seed      Seed the database"
	@echo "  db.reset     drop, create, deploy, verify, seed"
	@echo "  api          Run api (envdir env-dir node index.js)"
	@echo "  api.start    Start api in background"
	@echo "  api.stop     Stop background api"
	@echo "  ui.dev       Start the dev server for ui"
	@echo "  ui.build     Build ui/dist"
	@echo "  ui.start     Start ui dev server in background"
	@echo "  ui.stop      Stop background ui dev server"
	@echo "  nginx        Start nginx in background"
	@echo "  nginx.stop   Stop nginx"
	@echo "  start        api + nginx + ui in foreground (Ctrl-C stops all)"
	@echo "  up           db.reset + ui.build + start"
	@echo "  down         stop api + nginx + ui"

install:
	$(MAKE) -C services/lbry install
	$(MAKE) -C ui install

db.create:
	$(MAKE) -C db create

db.deploy:
	$(MAKE) -C db deploy

db.verify:
	$(MAKE) -C db verify

db.revert:
	$(MAKE) -C db revert

db.seed:
	$(MAKE) -C db seed

db.reset:
	$(MAKE) -C db reset

api:
	$(MAKE) -C services/lbry api

api.start:
	$(MAKE) -C services/lbry start

api.stop:
	$(MAKE) -C services/lbry stop

ui.dev:
	$(MAKE) -C ui dev

ui.build:
	$(MAKE) -C ui build

ui.start:
	$(MAKE) -C ui start

ui.stop:
	$(MAKE) -C ui stop

nginx:
	$(MAKE) -C services/nginx start

nginx.stop:
	$(MAKE) -C services/nginx stop

start:
	@trap 'echo; echo "stopping..."; $(MAKE) -C ui stop; $(MAKE) -C services/lbry stop; $(MAKE) -C services/nginx stop; exit 0' INT TERM; \
	$(MAKE) -C services/lbry start; \
	$(MAKE) -C services/nginx start; \
	$(MAKE) -C ui start; \
	echo "lbry running - open http://localhost:8060 (Ctrl-C to stop)"; \
	while true; do sleep 1; done

up: db.reset ui.build start

down: nginx.stop api.stop ui.stop
