default: build
all: build

AVRO=java -jar jar/avro-tools-1.7.7.jar idl
ICED=node_modules/.bin/iced

json/%.json : avdl/%.avdl
	$(AVRO) $< $@~ && mv $@~ $@

config:
	npm install -d


build-stamp: \
	json/login.json \
	json/signup.json
	date > $@

go/keybase_v1.go: build-stamp
	$(ICED) ./bin/compile.iced -d json -t go -o $@
	gofmt -w $@

clean:
	rm -rf json/*.json go/*.go

build: build-stamp go/keybase_v1.go

.PHONY: test setup config

