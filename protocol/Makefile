default: build
all: build

AVRO=java -jar jar/avro-tools-1.7.7.jar idl
ICED=node_modules/.bin/iced

json/%.json: avdl/%.avdl
	$(AVRO) $< $@~ && mv $@~ $@

config:
	npm install -d

build-stamp: \
	json/account.json \
	json/block.json \
	json/btc.json \
	json/config.json \
	json/crypto.json \
	json/ctl.json \
	json/debugging.json \
	json/device.json \
	json/doctor.json \
	json/doctor_ui.json \
	json/favorite.json \
	json/gpg_ui.json \
	json/identify.json \
	json/identify_ui.json \
	json/locksmith_ui.json \
	json/log_ui.json \
	json/login.json \
	json/login_ui.json \
	json/metadata.json \
	json/metadata_update.json \
	json/pgp.json \
	json/prove.json \
	json/prove_ui.json \
	json/quota.json \
	json/revoke.json \
	json/secret_ui.json \
	json/session.json \
	json/signup.json \
	json/sigs.json \
	json/stream_ui.json \
	json/test.json \
	json/track.json \
	json/ui.json \
	json/user.json
	@mkdir -p json
	date > $@

go/keybase_v1.go: build-stamp
	@mkdir -p go/
	$(ICED) ./bin/go.iced -v 2 -d json -t go -o $@
	gofmt -w $@

objc-build-stamp: build-stamp
	ruby ./bin/objc.rb
	date > $@

js/keybase_v1.js: build-stamp
	@mkdir -p js/
	node ./bin/js.js

clean:
	rm -rf json/*.json go/keybase_v1.go objc/* js/keybase_v1.js

build: build-stamp go/keybase_v1.go objc-build-stamp js/keybase_v1.js

.PHONY: test setup config

