default: build
all: build

AVRO=java -jar jar/avro-tools-1.7.7.jar idl
ICED=node_modules/.bin/iced

json/%.json: avdl/%.avdl
	$(AVRO) $< $@~ && mv $@~ $@

config:
	npm install -d

build-stamp: \
	json/block.json \
	json/config.json \
	json/device.json \
	json/doctor_ui.json \
	json/gpg.json \
	json/gpg_ui.json \
	json/identify.json \
	json/identify_ui.json \
	json/mykey.json \
	json/log_ui.json \
	json/login.json \
	json/login_ui.json \
	json/prove.json \
	json/prove_ui.json \
	json/quota.json \
	json/secret_ui.json \
	json/session.json \
	json/sibkey.json \
	json/signup.json \
	json/track.json \
	json/ui.json
	@mkdir -p json
	date > $@

go/keybase_v1.go: build-stamp
	@mkdir -p go/
	$(ICED) ./bin/go.iced -v 2 -d json -t go -o $@
	gofmt -w $@

objc-build-stamp: build-stamp
	ruby ./bin/objc.rb
	date > $@

clean:
	rm -rf json/*.json go/*.go objc/*

build: build-stamp go/keybase_v1.go objc-build-stamp

.PHONY: test setup config

