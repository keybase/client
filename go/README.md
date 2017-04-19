## Keybase [![Build Status](https://travis-ci.org/keybase/client.svg?branch=master)](https://travis-ci.org/keybase/client) [![Build status](https://ci.appveyor.com/api/projects/status/90mxorxtj6vixnum/branch/master?svg=true)](https://ci.appveyor.com/project/keybase/client-x5qrt/branch/master)

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

Code in this repository can run against either our [production
site](https://keybase.io) or our [staging
server](https://stage0.keybase.io).

### Install production client

If you're not building Keybase yourself, follow our [usual install
instructions](https://keybase.io/download).

### Building

Here's how to build the command line client on Linux or OSX. You need to
have both Git and **Go 1.7 or higher** installed. (Run `go version` to
see what version you have.)

```bash
# First we need to set up a GOPATH. This is a standard first step for
# building Go programs, so if you've done this already, skip on ahead.
# See also https://golang.org/doc/install.
mkdir ~/gopath
export GOPATH="$HOME/gopath"     # Consider putting this in your ~/.bashrc.
export PATH="$PATH:$GOPATH/bin"  # Ditto.

# Now for the actual clone and build.
go get github.com/keybase/client/go/keybase
go install -tags production github.com/keybase/client/go/keybase

# If you did the PATH bit above, this should just work.
keybase
```

### Run the service

```bash
keybase service
```

Or specify a custom home directory (and use -d for debug):

```bash
keybase -H ~/Projects/Keybase/dev -d service
```

Note that many commands will start the service in the background
automatically if it's not already running. See also `keybase ctl --help`.

### Run the client

```bash
keybase login
keybase id max
```

### Or you can run the client in "Standalone" Mode

```bash
# No service needed, but you'll be repeatedly prompted for your passphrase
keybase --standalone id max
```

### Run tests

```bash
cd $GOPATH/src/github.com/keybase/client/go/test
./run_tests.sh
```

### License

Most code is released under the New BSD (3 Clause) License.




