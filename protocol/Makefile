default: build
all: build

ICED=node_modules/.bin/iced
AVDL2JSON=node_modules/.bin/avdl2json
AVDLC=node_modules/.bin/avdlc

$(AVDL2JSON): config

json/%.json: avdl/%.avdl
	$(AVDL2JSON) -i $< -o $@~ && mv $@~ $@

config:
	npm i

# By default, all avdl/*.avdl are considered and made into outputs
# as long as they have messages in them. BUT you can override this
# check via -f. So the two files specified here via -f don't have
# messages but should be made into .json's...
build-stamp: avdl/*.avdl $(AVDL2JSON) | config
	@mkdir -p json
	$(AVDL2JSON) -2 -b -o json -f avdl/constants.avdl -f avdl/install.avdl  avdl/*.avdl
	date > $@

go-build-stamp: avdl/*.avdl $(AVDLC) | config
	@mkdir -p ../go/protocol
	$(AVDLC) -b -l go -o ../go/protocol avdl/*.avdl
	(cd ../go/protocol && go fmt ./...)
	date > $@

# We no longer build an objc client
# objc-build-stamp: build-stamp | config
	# @ # Runs without generating files (to validate)
	# ruby ./bin/objc.rb
	# date > $@

js/flow-types.js: build-stamp | config
	@mkdir -p js/
	node --harmony ./bin/flow.js
	cp ./js/flow-types.js ../shared/constants/types

js/keybase_v1.js: build-stamp | config
	@mkdir -p js/
	node --harmony ./bin/js.js
	cp ./js/keybase-v1.js ../shared/constants/types

swift-build-stamp: build-stamp | config
	@ # Runs without generating files (to validate)
	ruby ./bin/swift.rb
	date > $@

clean:
	rm -rf json/*.json js/*.js *build-stamp
	$(AVDLC) -c -b -l go -o ../go/protocol avdl/*.avdl

fmt:
	@./fmt.sh

build: fmt build-stamp go-build-stamp js/keybase_v1.js js/flow-types.js swift-build-stamp

.PHONY: test config
