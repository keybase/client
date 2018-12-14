.phony: default clean

default: mime_types.go

mime_types.go: builder/* Makefile
	cd builder && yarn install && node index.js > ../mime_types.go
	go build
	gofmt -s -w -e mime_types.go

clean:
	rm -rf builder/node_modules
