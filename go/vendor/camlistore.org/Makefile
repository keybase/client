# The normal way to build Camlistore is just "go run make.go", which
# works everywhere, even on systems without Make.  The rest of this
# Makefile is mostly historical and should hopefully disappear over
# time.
all:
	go run make.go

# On OS X with "brew install sqlite3", you need PKG_CONFIG_PATH=/usr/local/Cellar/sqlite/3.7.17/lib/pkgconfig/
full:
	go install --ldflags="-X camlistore.org/pkg/buildinfo.GitInfo "`./misc/gitversion` `pkg-config --libs sqlite3 1>/dev/null 2>/dev/null && echo "--tags=with_sqlite"` ./pkg/... ./server/... ./cmd/... ./third_party/... ./dev/...


# Workaround Go bug where the $GOPATH/pkg cache doesn't know about tag changes.
# Useful when you accidentally run "make" and then "make presubmit" doesn't work.
# See https://code.google.com/p/go/issues/detail?id=4443
forcefull:
	go install -a --tags=with_sqlite ./pkg/... ./server/camlistored ./cmd/... ./dev/...

oldpresubmit: fmt
	SKIP_DEP_TESTS=1 go test `pkg-config --libs sqlite3 1>/dev/null 2>/dev/null && echo "--tags=with_sqlite"` -short ./pkg/... ./server/camlistored/... ./server/appengine ./cmd/... ./dev/... && echo PASS

presubmit: fmt
	go run dev/devcam/*.go test -short

embeds:
	go install ./pkg/fileembed/genfileembed/ && genfileembed ./server/camlistored/ui && genfileembed ./pkg/server

UIDIR = server/camlistored/ui

NEWUIDIR = server/camlistored/newui

clean:
	rm -f $(NEWUIDIR)/all.js $(NEWUIDIR)/all.js.map

fmt:
	go fmt camlistore.org/cmd... camlistore.org/dev... camlistore.org/misc... camlistore.org/pkg... camlistore.org/server...
