default: build
all: build

ICED=node_modules/.bin/iced
AVDL2JSON=node_modules/.bin/avdl2json
AVDLC=node_modules/.bin/avdlc

json/%.json: avdl/%.avdl
	$(AVDL2JSON) -i $< -o $@~ && mv $@~ $@

config:
	npm install -d

# By default, all avdl/*.avdl are considered and made into outputs
# as long as they have messages in them. BUT you can override this
# check via -f. So the two files specified here via -f don't have
# messages but should be made into .json's...
build-stamp: avdl/*.avdl $(AVDL2JSON)
	@mkdir -p json
	$(AVDL2JSON) -b -o json -f avdl/constants.avdl -f avdl/install.avdl  avdl/*.avdl
	date > $@

go-build-stamp: avdl/*.avdl $(AVDLC)
	@mkdir -p ../go/protocol
	$(AVDLC) -b -l go -o ../go/protocol avdl/*.avdl
	(cd ../go/protocol && go fmt ./...)
	date > $@

objc-build-stamp: build-stamp
	@ # Runs without generating files (to validate)
	ruby ./bin/objc.rb
	date > $@

js/flow-types.js: build-stamp
	@mkdir -p js/
	node --harmony ./bin/flow.js
	cp ./js/flow-types.js ../shared/constants/types

js/keybase_v1.js: build-stamp
	@mkdir -p js/
	node --harmony ./bin/js.js
	cp ./js/keybase-v1.js ../shared/constants/types

swift-build-stamp: build-stamp
	@ # Runs without generating files (to validate)
	ruby ./bin/swift.rb
	date > $@

clean:
	rm -rf json/*.json js/keybase_v1.js swift/* *build-stamp
	$(AVDLC) -c -b -l go -o ../go/protocol avdl/*.avdl

deps:
	npm install

fmt:
	@./fmt.sh

build: fmt build-stamp go-build-stamp js/keybase_v1.js js/flow-types.js objc-build-stamp swift-build-stamp

.PHONY: test setup config
