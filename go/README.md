## Keybase

This repository contains the Keybase core crypto libraries, command-line
utility, and local Keybase service.  All code is written in the [Go
Language](https://golang.org), making heavy use of Go's
[OpenPGP](https://godoc.org/golang.org/x/crypto/openpgp) and
[NaCl](https://godoc.org/golang.org/x/crypto/nacl)
[Library](https://github.com/agl/ed25519) implementation.

Our intended architecture is that `keybase` runs a local service on Desktop
environments, which can be connected to over a local Unix domain sockets on OSX/Linux,
and over named pipes on Windows. The persistent service will eventually listen
for asynchronous server updates, and will serve several clients, like the command-line
utility, the graphical desktop app ([see `electron`](../electron)), and the Keybase
FUSE-mounted file system.

For now, the only client ready for production is the command-line utility.

### Status

The Keybase service/client is approaching a release-ready state on OSX and Linux,
with Windows shortly behind.  Code in this repository is safe to run against either
our [production site](https://keybase.io) or our [staging server](https://stage0.keybase.io).

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
cd $GOPATH/src/github.com/keybase/client/go
export GO15VENDOREXPERIMENT=1 # all dependencies are vendored
go install
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

### Run the client

```bash
./keybase id max
```

### Or you can run the client in "Standalone" Mode

```bash
./keybase --standalone id max
```

### Testing

To test install Boot2Docker and run (if you have access to our server code):

```bash
docker build -t kbweb .
make test
```

### License

Most code is released under the New BSD (3 Clause) License.
