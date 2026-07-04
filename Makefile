# Makefile for the cockpitremote Cockpit package.
#
#   make            build production bundle into dist/
#   make watch      rebuild on change (development)
#   make install    install system-wide (PREFIX=/usr/local by default)
#   make devel-install    symlink dist/ into ~/.local/share/cockpit
#   make devel-uninstall  remove the development symlink
#   make test       run unit tests
#   make lint       run eslint
#   make clean      remove build output

PACKAGE = cockpitremote
PREFIX ?= /usr/local
DESTDIR ?=
INSTALLDIR = $(DESTDIR)$(PREFIX)/share/cockpit/$(PACKAGE)
DEVDIR = $(HOME)/.local/share/cockpit/$(PACKAGE)

all: build

build: node_modules
	NODE_ENV=production node build.js

watch: node_modules
	node build.js --watch

node_modules: package.json
	npm install --no-audit --no-fund
	@touch node_modules

install: build
	mkdir -p $(INSTALLDIR)
	cp -r dist/. $(INSTALLDIR)/

uninstall:
	rm -rf $(INSTALLDIR)

devel-install: build
	mkdir -p $(dir $(DEVDIR))
	ln -sfn $(CURDIR)/dist $(DEVDIR)

devel-uninstall:
	rm -f $(DEVDIR)

test: node_modules
	npx vitest run

lint: node_modules
	npx eslint src test

clean:
	rm -rf dist

.PHONY: all build watch install uninstall devel-install devel-uninstall test lint clean
