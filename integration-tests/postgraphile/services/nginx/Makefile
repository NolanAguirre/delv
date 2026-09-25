SHELL := /bin/sh

.PHONY: start stop

start:
	nginx -p $(CURDIR)/ -c $(CURDIR)/nginx.conf

stop:
	@if [ -f nginx.pid ]; then \
		kill "`cat nginx.pid`" 2>/dev/null || true; \
		echo "nginx stopped"; \
	else \
		echo "nginx not running"; \
	fi
