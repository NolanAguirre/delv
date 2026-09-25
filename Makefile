SHELL := /bin/sh

.PHONY: start

start:
	$(MAKE) -C integration-tests/postgraphile start
