AVDLC=node_modules/.bin/avdlc
protocols=$(patsubst %-avdl,%.build-stamp,$(wildcard *-avdl))

default: all
all: build
	@echo $(protocols)

config:
	npm install -d

%.build-stamp: %-avdl/*.avdl
	@mkdir -p ../protocol/$*
	$(AVDLC) -b -l go -o ../protocol/$* $*-avdl/*.avdl
	(cd ../protocol/$* && go fmt ./...)
	date > $@

clean:
	rm *.build-stamp
	rm -rf ../protocol/*

deps:
	npm install

fmt:
	@./fmt.sh

build: fmt $(protocols)

.PHONY: test setup config
