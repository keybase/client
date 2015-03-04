COVERTEST=go test -covermode=count -coverprofile=/tmp/count.out
COVERWEB=go tool cover -html=/tmp/count.out

fmt:
	go fmt ./...

vet:
	go vet ./...

kbvet:
	go vet ./... 2>&1 | grep -v "possible formatting directive" | grep -v "should have signature WriteTo"

lint:
	golint ./...

cover:
	go test -covermode=count ./...

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
