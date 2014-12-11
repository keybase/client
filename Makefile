default: build
all: build

AVRO=java -jar jar/avro-tools-1.7.7.jar idl
BUILD_STAMP=build-stamp

json/%.json : avdl/%.avdl
	$(AVRO) $< $@~ && mv $@~ $@

$(BUILD_STAMP): \
	json/login.json \
	json/signup.json
	date > $@

clean:
	rm -rf json/*.json

build: $(BUILD_STAMP)

.PHONY: test setup

