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
# We don't need kbgitkbfs1 in JSON so we aren't including them in the commands
# here.
build-stamp: avdl/keybase1/*.avdl avdl/gregor1/*.avdl avdl/chat1/*.avdl avdl/stellar1/*.avdl $(AVDL2JSON) | config
	@mkdir -p json/keybase1
	@mkdir -p json/gregor1
	@mkdir -p json/chat1
	@mkdir -p json/stellar1
	$(AVDL2JSON) -2 -b -o json/keybase1 -f avdl/keybase1/constants.avdl -f avdl/keybase1/install.avdl  avdl/keybase1/*.avdl
	$(AVDL2JSON) -2 -b -o json/gregor1 -f workaround avdl/gregor1/*.avdl
	$(AVDL2JSON) -2 -b -o json/chat1 -f workaround avdl/chat1/*.avdl
	$(AVDL2JSON) -2 -b -o json/stellar1 -f workaround avdl/stellar1/*.avdl
	date > $@

go-build-stamp: avdl/keybase1/*.avdl avdl/gregor1/*.avdl avdl/chat1/*.avdl avdl/stellar1/*.avdl $(AVDLC) | config
	@mkdir -p ../go/protocol/keybase1
	@mkdir -p ../go/protocol/gregor1
	@mkdir -p ../go/protocol/chat1
	@mkdir -p ../go/protocol/stellar1
	@mkdir -p ../go/protocol/kbgitkbfs1
	$(AVDLC) -b -l go -m -o ../go/protocol/keybase1 avdl/keybase1/*.avdl
	$(AVDLC) -b -l go -m -o ../go/protocol/gregor1 avdl/gregor1/*.avdl
	$(AVDLC) -b -l go -m -o ../go/protocol/chat1 avdl/chat1/*.avdl
	$(AVDLC) -b -l go -m -o ../go/protocol/stellar1 avdl/stellar1/*.avdl
	$(AVDLC) -b -l go -m -o ../go/protocol/kbgitkbfs1 avdl/kbgitkbfs1/*.avdl
	(cd ../go/protocol && go fmt ./...)
	date > $@

js/rpc.js: build-stamp | config
	@mkdir -p js/
	node ./bin/flow.js
	cp ./js/rpc*.tsx ../shared/constants/types
	cp ./js/engine-gen.json ../shared/actions/json

build-go-bot-types: avdl/keybase1/*.avdl avdl/gregor1/*.avdl avdl/chat1/*.avdl avdl/stellar1/*.avdl $(AVDLC) | config
	$(AVDLC) -b -l go -m -t -o ../../go-keybase-chat-bot/kbchat/types/keybase1 avdl/keybase1/*.avdl
	$(AVDLC) -b -l go -m -t -o ../../go-keybase-chat-bot/kbchat/types/gregor1 avdl/gregor1/*.avdl
	$(AVDLC) -b -l go -m -t -o ../../go-keybase-chat-bot/kbchat/types/chat1 avdl/chat1/*.avdl
	$(AVDLC) -b -l go -m -t -o ../../go-keybase-chat-bot/kbchat/types/stellar1 avdl/stellar1/*.avdl
	(cd ../../go-keybase-chat-bot/kbchat/types && goimports -w .)

clean:
	rm -rf json/*.json json/*/*.json js/* *build-stamp
	$(AVDLC) -c -b -l go -m -o ../go/protocol/keybase1 avdl/keybase1/*.avdl
	$(AVDLC) -c -b -l go -m -o ../go/protocol/gregor1 avdl/gregor1/*.avdl
	$(AVDLC) -c -b -l go -m -o ../go/protocol/chat1 avdl/chat1/*.avdl
	$(AVDLC) -c -b -l go -m -o ../go/protocol/stellar1 avdl/stellar1/*.avdl
	$(AVDLC) -c -b -l go -m -o ../go/protocol/kbgitkbfs1 avdl/kbgitkbfs1/*.avdl

fmt:
	@./fmt.sh

build: fmt build-stamp go-build-stamp js/rpc.js

.PHONY: test config
