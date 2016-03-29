-----------------------------

# Running KBFS [![Build Status](https://travis-ci.com/keybase/kbfs.svg?token=o83uSEjtx4xskKjG2ZyS&branch=master)](https://travis-ci.com/keybase/kbfs) [![Build status](https://ci.appveyor.com/api/projects/status/xpxqhgpl60m1h3sb/branch/master?svg=true)](https://ci.appveyor.com/project/keybase/kbfs/branch/master)

To run the KBFS FUSE client:

* Install FUSE.
  - For OS X, https://osxfuse.github.io/.
* Check out https://github.com/keybase/keybase, and follow its
  README.md to install and run a local copy of the Keybase webserver
  on port 3000.
* Install Go 1.6.

* Check out https://github.com/keybase/client, and do:

        ln -s $GOPATH/src/github.com/keybase/client/git-hooks/pre-commit $GOPATH/src/github.com/keybase/kbfs/.git/hooks/
        go get -u github.com/golang/lint/golint
        go get golang.org/x/tools/cmd/vet

If the last command fails please see [here](https://groups.google.com/forum/#!msg/golang-nuts/lz0nPiUwfUk/E92u9uZhMHYJ).

* Run the service

        rm -rf ~/kbtest
        cd client/go/keybase
        ./keybase -H ~/kbtest service start

* Sign up one (or more) users in a different terminal

        cd client/go/keybase
        ./keybase -H ~/kbtest signup -c 202020202020202020202020 # -c value is a reusable test invite code

Now, in kbfs/:

    go get -u ./...
    ln -s $GOPATH/src/github.com/keybase/client/git-hooks/pre-commit .git/pre-commit
    cd kbfsfuse
    GO15VENDOREXPERIMENT=1 go build
    mkdir /tmp/kbfs  # or whatever you prefer
    HOME=~/kbtest ./kbfsfuse -debug -client /tmp/kbfs

Now you can do cool stuff like (assuming keybase users "strib" and
"max"; logged in as "strib"):

    ls /tmp/kbfs/strib
    echo blahblah > /tmp/kbfs/strib/foo
    ls /tmp/kbfs/strib,max

Assertions in file names should work too.  Note that public
directories must be created by the user (by ls or something) before a
different user can see it.  So /tmp/kbfs/max/public won't be visible
to 'strib' until 'max' looks in his private folder while logged in.

# Resetting

If you want to reset your file system state, and you're in kbfs/kbfsfuse, do:

    <kill running kbfsfuse>
    fusermount -u /tmp/kbfs # on OSX: 'diskutil unmount /tmp/kbfs'
    rm -rf kbfs_*/

# Code style

The precommit hooks (you created the symlink earlier, right?) takes
care of running gofmt and govet on all your code before every commit.
Though it doesn't happen automatically, we also expect your code to be
as "lint-free" as possible.  Running golint is easy from the top-level
kbfs directory:

    make lint

# Vendoring

KBFS vendors all of its dependencies into the local `vendor`
directory.  To add or update dependencies, use the `govendor` tool, as
follows:

    go install github.com/kardianos/govendor
    govendor add github.com/foo/bar  # or `govendor update`
    git add vendor

# Testing

From kbfs/:

    go test -i ./...
    go test ./...

If you change anything in interfaces.go, you will have to regenerate
the mock interfaces used by the tests:

    cd libkbfs
    ./gen_mocks.sh

(Right now the mocks are checked into the repo; this isn't ideal and
we should probably change it.)

# Domain-specific KBFS test language tests

Please see [test/README.md](test/README.md) for more information.

# Backend integration tests

First, make sure you have these prereqs:
    sudo apt-get install openjdk-7-jre

From bserver/:
	make test

	Caveats: One needs to have a local KB webserver running (backend need to connect to localhost:44003 to verify user session)
        One also need to have logged into a KB daemon (from whom I obtain the client session token and send to the backend server)

# Testing with Docker

For testing, it is often useful to bring up the Keybase daemon in a
clean environment, potentially multiple copies of it at once for
different users.  Please read the instructions at
[kbfsdocker/README.md](kbfsdocker/README.md).
