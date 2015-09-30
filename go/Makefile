GO15VENDOREXPERIMENT=1
COVERWEB=go tool cover -html=/tmp/count.out

fmt:
	go fmt ./...

vet:
	go vet ./...

lint:
	golint ./... | grep -v ^vendor | grep -v ^protocol | grep -v comment | grep -v KeysById | grep -v "error should be the last type" || echo "Lint-free!"

# to run splint, first do this:  go get stathat.com/c/splint
splint:
	splint -s 100 `find . -name "*.go"`

cover:
	go test -covermode=count ./...

test:
	test/check_or_start_kbweb.sh
	go test ./...
	test/pause_kbweb.sh

testclean:
	test/nuke_kbweb.sh

coverclient:
	$(COVERTEST) ./client
	$(COVERWEB)

coverdaemon:
	$(COVERTEST) ./daemon
	$(COVERWEB)

coverengine:
	$(COVERTEST) ./engine
	$(COVERWEB)

coverlibcmdline:
	$(COVERTEST) ./libcmdline
	$(COVERWEB)

coverlibkb:
	$(COVERTEST) ./libkb
	$(COVERWEB)

coverclean:
	rm /tmp/count.out

.PHONY: test splint fmt lint vet cover testclean coverclient coverdaemon coverengine coverlibcmdline coverlibkb coverclean
