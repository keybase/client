default: build
all: build

AVRO=java -jar jar/avro-tools-1.7.7.jar idl
BUILD_STAMP=build-stamp

json/%.json : avdl/%.avdl
	$(AVRO) $< $@

$(BUILD_STAMP): \
	json/login.json \
	json/signup.json
	date > $@

clean:
	find json/ -type f -name *.json -exec rm {} \;

build: $(BUILD_STAMP)

.PHONY: test setup

