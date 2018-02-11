.phony: default clean

default: init.go clean

init.go: builder/*
	cd builder && yarn install && node index.js > ../init.go
	go build

clean:
	rm -rf builder/node_modules
