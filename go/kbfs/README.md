# Keybase Filesystem (KBFS) [![Build Status](https://travis-ci.org/keybase/kbfs.svg?branch=master)](https://travis-ci.org/keybase/kbfs) [![Build status](https://ci.appveyor.com/api/projects/status/xpxqhgpl60m1h3sb/branch/master?svg=true)](https://ci.appveyor.com/project/keybase/kbfs/branch/master)

This repository contains the official [Keybase](https://keybase.io)
implementation of the client-side code for the Keybase filesystem
(KBFS). See [the KBFS documentation](https://keybase.io/docs/kbfs) for an
introduction and overview.

![Sharing](https://keybase.io/images/github/repo_share.png?)

All code is written in the [Go Language](https://golang.org), and relies
on the [Keybase
service](https://github.com/keybase/client/tree/master/go).

### Architecture

This client allows you to mount KBFS as a proper filesystem at some
mountpoint on your local device (by default, `/keybase/`).  It
communicates locally with the Keybase service, and remotely with three
types of KBFS servers (block servers, metadata servers, and key
servers).

The code is organized as follows:

* [cache](cache/): Generic cache data structures.
* [data](data/): Data structures and logic for KBFS file and directory data.
* [dokan](dokan/): Helper code for running Dokan filesystems on Windows.
* [env](env/): Code to implement libkbfs.Context in terms of libkb.
* [favorites](favorites/): Data structures for the favorited lists of
  top-level folders (TLFs) that appear under private/, public/, and
  team/.
* [fsrpc](fsrpc/): RPC interfaces that connected clients can call in KBFS,
  to do certain operations, such as listing files.
* [idutil](idutil/): Basic data structures, interfaces, and helper
  code for dealing with identity data for users and teams.
* [ioutil](ioutil/): Helper functions for I/O.
* [kbfsblock](kbfsblock/): Types and functions to work with KBFS blocks.
* [kbfscodec](kbfscodec/): Interfaces and types used for serialization in KBFS.
* [kbfscrypto](kbfscrypto/): KBFS-specific cryptographic types and functions.
* [kbfsdokan](kbfsdokan/): The main executable for running KBFS on
  Windows.
* [kbfsfuse](kbfsfuse/): The main executable for running KBFS on Linux
  and OS X.
* [kbfsgit](kbfsgit/): The main executable for the Keybase git remote helper.
* [kbfshash](kbfshash/): An implementation of the KBFS hash spec.
* [kbfsmd](kbfsmd/): Types and functions to work with KBFS TLF metadata.
* [kbfssync](kbfssync/): KBFS-specific synchronization primitives.
* [kbfstool](kbfstool/): A thin command line utility for interacting with KBFS
  without using a filesystem mountpoint.
* [kbpagesconfig](kbpagesconfig/): Configuration code for Keybase Pages.
* [kbpagesd](kbpagesd/): The main executable for Keybase Pages.
* [libcontext](libcontext/): KBFS-specific context helper code.
* [libdokan](libdokan/): Library code gluing together KBFS and the
  Dokan protocol.
* [libfs](libfs/): Common library code useful to any filesystem
  presentation layer for KBFS.
* [libfuse](libfuse/): Library code gluing together KBFS and the FUSE
  protocol.
* [libgit](libgit/): Library for git-related logic.
* [libhttpserver](libhttpserver/): Library for serving KBFS files with
  a local HTTP server.
* [libkey](libkey/): Library for managing KBFS server keys and key metadata.
* [libkbfs](libkbfs/): The core logic for KBFS.
* [libmime](libmime/): Library for determining the MIME types of KBFS
  files.
* [libpages](libpages/): Library for the logic behind Keybase Pages.
* [metricsutil](metricsutil/): Helper code for collecting metrics.
* [redirector](redirector/): The executable that redirects user FUSe
  requests to the correct user KBFS mount.  The redirector is usually
  mounted at `/keybase` on Linux and macOS.
* [simplefs](simplefs/): A simple RPC-based interface to KBFS.
* [stderrutils](stderrutils/): A simple library for dealing with
  stderr on different platforms.
* [sysutils](sysutils/): Library for dealing with platform-specific
  systems stuff.
* [test](test/): A test harness with a domain-specific test language
  and tests in that language.
* [tlf](tlf/): Code and structures for top-level folders (TLFs).
* [tlfhandle](tlfhandle/): The data structure for "Handles" to
  top-level folders (TLFs), which represent an identifier for each
  TLF, containing all the user or team IDs associated with the it.

### Status

KBFS currently works on both Linux (at least Debian, Ubuntu and Arch),
OS X, and Windows.  It is approaching release ready, though currently
it is still in alpha.  There may still be bugs, so please keep backups
of any important data you store in KBFS.  Currently our pre-built
packages are available by invitation only.

KBFS depends in part on the following awesome technologies to present
a mountpoint on your device:

* [FUSE](https://github.com/libfuse/) (on Linux)
* [FUSE for OS X](https://osxfuse.github.io/) (on OS X)
* [Dokany](https://github.com/dokan-dev/dokany) (on Windows)

See [our vendor directory](vendor/) for a complete list of open source
packages KBFS uses.

Currently, our server implementations are not open source.

### To run from source against production KBFS servers

#### On Linux or OS X:

Prerequisites:

* [Go 1.7](https://golang.org/dl/) or higher.
* A running Keybase client service (see [instructions](https://github.com/keybase/client/tree/master/go)).
* On OS X, you may have to [install FUSE yourself](https://osxfuse.github.io/).
  * You may need to pass the `--use-system-fuse` flag to `kbfsfuse` if
    you install FUSE yourself.
* Then, mount KBFS at `/keybase/` as follows:

```bash
    cd kbfsfuse
    go install
    mkdir -p /keybase && sudo chown $USER /keybase
    KEYBASE_RUN_MODE=prod kbfsfuse /keybase
```

Note that our pre-built packages for OS X include a branded version of
FUSE for OS X, to ensure that it doesn't conflict with other local
FUSE installations.  It is still open source -- see
[here](https://github.com/keybase/client/blob/master/osx/Fuse/build.sh)
to see how we build it.

#### On Windows:

See our [kbfsdokan](kbfsdokan/) documentation.

#### On FreeBSD:

There are instructions for getting KBFS running on FreeBSD
[here](https://wiki.freebsd.org/Ports/security/kbfs).  This is a
user-supported effort, which is not officially supported by the
Keybase team at the moment.

### To run from source against local in-memory servers

```bash
kbfsfuse -bserver=memory -mdserver=memory -localuser strib /keybase
```

(Use `-bserver=dir:/path/to/dir` and `-mdserver=dir:/path/to/dir` if
instead you want to save your data to local disk.)

Now you can do cool stuff like:

```bash
ls /keybase/private/strib
echo blahblah > /keybase/private/strib/foo
ls /keybase/private/strib,max
```

(Note that "localuser" mode has only four hard-coded users to play
with: "strib", "max", "chris", and "fred".)

### Code style

We require all code to pass `gofmt` and `govet`.  You can install our
precommit hooks to make sure your code passes `gofmt` and `govet`:

```bash
go get golang.org/x/tools/cmd/vet
ln -s $GOPATH/src/github.com/keybase/client/git-hooks/pre-commit $GOPATH/src/github.com/keybase/client/go/kbfs/.git/hooks/pre-commit
```

Though it doesn't happen automatically, we also expect your code to be
as "lint-free" as possible.  Running golint is easy from the top-level
kbfs directory:

```bash
go get -u github.com/golang/lint/golint
make lint
```

### Vendoring

KBFS vendors all of its dependencies into the local `vendor`
directory.  To add or update dependencies, use the `govendor` tool, as
follows:

```bash
go install github.com/kardianos/govendor
govendor add github.com/foo/bar  # or `govendor update`
git add --all vendor
```

### Testing

From kbfs/:

```bash
go test -i ./...  # install dependencies
go test ./...     # run tests
```

If you change anything in interfaces.go, you will have to regenerate
the mock interfaces used by the tests (make sure you have [mockgen](https://github.com/golang/mock)
installed):

```bash
cd libkbfs
./gen_mocks.sh
```

(Right now the mocks are checked into the repo; this isn't ideal and
we should probably change it.)

### Licensing

Most code is released under the New BSD (3 Clause) License.  If
subdirectories include a different license, that license applies
instead.  (Specifically, [dokan/dokan_header](dokan/dokan_header) and
most subdirectories in [vendor](vendor/) are released under their own
licenses.)


