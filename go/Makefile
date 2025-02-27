COVERWEB=go tool cover -html=/tmp/count.out

fmt:
	go fmt ./...

vet:
	go vet ./...

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

gen-deps:
	./gen_deps.pl

linux-clear-devel-secrets:
	secret-tool clear service-base keybase-devel

linux-clear-test-secrets:
	secret-tool clear service-base keybase-devel-test

GOLANGCI_RUN_OPT = --color auto

golangci-lint-kbfs:
	go list -f '{{.Dir}}' ./kbfs/... | fgrep -v dokan | xargs realpath --relative-to=. | xargs golangci-lint run $(GOLANGCI_RUN_OPT) --timeout 5m0s

golangci-lint-nonkbfs:
	go list -f '{{.Dir}}' ./... | fgrep -v protocol  | fgrep -v kbfs | xargs realpath --relative-to=. | xargs golangci-lint run $(GOLANGCI_RUN_OPT) --timeout 10m0s

.PHONY: test splint fmt lint vet cover testclean coverclient coverdaemon coverengine coverlibcmdline coverlibkb coverclean gen-deps
