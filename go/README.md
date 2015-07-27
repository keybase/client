## Keybase

### Building

```bash
cd keybase
go get -u
// Nojima: The above wasn't working for me on OS X. In $GOPATH/src/github.com/keybase/client run go get ./...
go build -a
// Nojima: Run the above in $GOPATH/src/github.com/keybase/client/go/keybase
```

### Run the service

```bash
cd keybase
./keybase service
```

Or specify a custom home directory (and use -d for debug):

```bash
./keybase -H ~/Projects/Keybase/dev -d service
```

### Testing

To test install Boot2Docker and run:

```bash
docker build -t kbweb .
make test
```
