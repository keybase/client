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
	json/constants.json \
	json/crypto.json \
	json/ctl.json \
	json/debugging.json \
	json/delegate_ui_ctl.json \
	json/device.json \
	json/favorite.json \
	json/gpg_ui.json \
	json/identify.json \
	json/identify_ui.json \
	json/install.json \
	json/kbfs.json \
	json/kex2provisioner.json \
	json/kex2provisionee.json \
	json/log.json \
	json/log_ui.json \
	json/login.json \
	json/login_ui.json \
	json/metadata.json \
	json/metadata_update.json \
	json/notify_ctl.json \
	json/notify_fs.json \
	json/notify_session.json \
	json/notify_tracking.json \
	json/notify_users.json \
	json/pgp.json \
	json/pgp_ui.json \
	json/prove.json \
	json/prove_ui.json \
	json/provision_ui.json \
	json/quota.json \
	json/revoke.json \
	json/saltpack.json \
	json/saltpack_ui.json \
	json/secretkeys.json \
	json/secret_ui.json \
	json/session.json \
	json/signup.json \
	json/sigs.json \
	json/stream_ui.json \
	json/test.json \
	json/track.json \
	json/ui.json \
	json/update.json \
	json/update_ui.json \
	json/user.json
	@mkdir -p json
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
	cp ./js/flow-types.js ../react-native/react/constants/types

js/keybase_v1.js: build-stamp
	@mkdir -p js/
	node ./bin/js.js
	cp ./js/keybase_v1.js ../react-native/react/constants/types

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

.PHONY: test setup config
