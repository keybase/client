
default: build
all: build

build:
	npm i
	node_modules/.bin/avdlc -l go -o prot.go -i prot.avdl
	go fmt .

.PHONY: build