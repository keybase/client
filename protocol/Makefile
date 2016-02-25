default: build
all: build

ICED=node_modules/.bin/iced
AVDL2JSON=node_modules/.bin/avdl2json

json/%.json: avdl/%.avdl
	$(AVDL2JSON) -i $< -o $@~ && mv $@~ $@

config:
	npm install -d

# By default, all avdl/*.avdl are considered and made into outputs
# as long as they have messages in them. BUT you can override this
# check via -f. So the two files specified here via -f don't have
# messages but should be made into .json's...
build-stamp:
	@mkdir -p json
	$(AVDL2JSON) -b -o json -f avdl/constants.avdl -f avdl/install.avdl  avdl/*.avdl
	date > $@

../go/protocol/keybase_v1.go: build-stamp ./bin/go.iced
	@mkdir -p ../go/protocol
	$(ICED) ./bin/go.iced -v 2 -d json -t go -o $@
	gofmt -w $@

objc-build-stamp: build-stamp
	@ # Runs without generating files (to validate)
	ruby ./bin/objc.rb
	date > $@

js/flow-types.js: build-stamp
	@mkdir -p js/
	node ./bin/flow.js
	cp ./js/flow-types.js ../shared/constants/types

js/keybase_v1.js: build-stamp
	@mkdir -p js/
	node ./bin/js.js
	cp ./js/keybase-v1.js ../shared/constants/types

swift-build-stamp: build-stamp
	@ # Runs without generating files (to validate)
	ruby ./bin/swift.rb
	date > $@

clean:
	rm -rf json/*.json ../go/protocol/keybase_v1.go js/keybase_v1.js swift/*

deps:
	npm install

fmt:
	@./fmt.sh

build: fmt build-stamp ../go/protocol/keybase_v1.go js/keybase_v1.js js/flow-types.js objc-build-stamp swift-build-stamp

.PHONY: test setup config build-stamp
