SHELL := /bin/sh

.PHONY: create deploy verify revert seed reset

create:
	createdb lbry 2>/dev/null || true

deploy:
	sqitch deploy db:pg:lbry

verify:
	sqitch verify db:pg:lbry

revert:
	sqitch revert -y db:pg:lbry

seed:
	psql postgres:///lbry -v ON_ERROR_STOP=1 -f seed.sql

reset:
	dropdb --if-exists lbry
	createdb lbry
	$(MAKE) deploy verify seed
