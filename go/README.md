## Keybase

### Install production client

#### Mac

    brew tap keybase/beta
    brew update
    brew install keybase/beta/keybase

#### Linux

Download the appropriate package:

* [64-bit .deb](https://dist.keybase.io/linux/deb/keybase-latest-amd64.deb)
* [32-bit .deb](https://dist.keybase.io/linux/deb/keybase-latest-i386.deb)
* [64-bit .rpm](https://dist.keybase.io/linux/rpm/keybase-latest-x86_64.rpm)
* [32-bit .rpm](https://dist.keybase.io/linux/rpm/keybase-latest-i386.rpm)
* [Arch Linux](https://aur.archlinux.org/packages/keybase-release/)

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
