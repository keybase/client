default: build
all: build

ICED=node_modules/.bin/iced
AVDL2JSON=node_modules/.bin/avdl2json
AVDLC=node_modules/.bin/avdlc

$(AVDL2JSON): config

json/%.json: avdl/%.avdl
	$(AVDL2JSON) -i $< -o $@~ && mv $@~ $@

config:
	yarn --pure-lockfile

# By default, all avdl/*.avdl are considered and made into outputs
# as long as they have messages in them. BUT you can override this
# check via -f. So the two files specified here via -f don't have
# messages but should be made into .json's...
build-stamp: avdl/keybase1/*.avdl avdl/gregor1/*.avdl avdl/chat1/*.avdl $(AVDL2JSON) | config
	@mkdir -p json/keybase1
	@mkdir -p json/gregor1
	@mkdir -p json/chat1
	$(AVDL2JSON) -2 -b -o json/keybase1 -f avdl/keybase1/constants.avdl -f avdl/keybase1/install.avdl  avdl/keybase1/*.avdl
	$(AVDL2JSON) -2 -b -o json/gregor1 -f workaround avdl/gregor1/*.avdl
	$(AVDL2JSON) -2 -b -o json/chat1 -f workaround avdl/chat1/*.avdl
	date > $@

go-build-stamp: avdl/keybase1/*.avdl avdl/gregor1/*.avdl avdl/chat1/*.avdl $(AVDLC) | config
	@mkdir -p ../go/protocol/keybase1
	@mkdir -p ../go/protocol/gregor1
	@mkdir -p ../go/protocol/chat1
	$(AVDLC) -b -l go -o ../go/protocol/keybase1 avdl/keybase1/*.avdl
	$(AVDLC) -b -l go -o ../go/protocol/gregor1 avdl/gregor1/*.avdl
	$(AVDLC) -b -l go -o ../go/protocol/chat1 avdl/chat1/*.avdl
	(cd ../go/protocol && go fmt ./...)
	date > $@

js/flow-types.js: build-stamp | config
	@mkdir -p js/
	node --harmony ./bin/flow.js
	cp ./js/flow-types* ../shared/constants/types

clean:
	rm -rf json/*/*.json js/*.js *build-stamp
	$(AVDLC) -c -b -l go -o ../go/protocol/keybase1 avdl/keybase1/*.avdl
	$(AVDLC) -c -b -l go -o ../go/protocol/gregor1 avdl/gregor1/*.avdl
	$(AVDLC) -c -b -l go -o ../go/protocol/chat1 avdl/chat1/*.avdl

fmt:
	@./fmt.sh

build: fmt build-stamp go-build-stamp js/flow-types.js

.PHONY: test config
