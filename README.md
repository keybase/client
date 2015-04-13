-----------------------------

# Running KBFS

To run the KBFS FUSE client:

* Install FUSE.
  - For OS X, https://osxfuse.github.io/.
* Check out https://github.com/keybase/keybase, and follow its
  README.md to install and run a local copy of the Keybase webserver
  on port 3000.
* Check out https://github.com/keybase/client, and do:

        go get -u ./...
        cd daemon && go build && cd ..
        cd client && go build && cd ..
* Run the daemon

        rm -rf ~/kbtest
        cd daemon
        ./daemon -d -H ~/kbtest -s http://localhost:3000
* Sign up one (or more) users in a different terminal

        cd client
        ./client -H ~/kbtest signup

Now, in kbfs/:

    go get -u ./...
    cd kbfsfuse
    go build
    mkdir /tmp/kbfs  # or whatever you prefer
    ./kbfsfuse -debug -client /tmp/kbfs

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
    fusermount -u /tmp/kbfs
    rm -rf kbfs_*/

# Testing

From kbfs/:

    go test -i ./...
    go test ./...

Run integration tests (TODO(jinyang): update with daemon commands):

    go test -tags=integration ./...

If you change anything in interfaces.go, you will have to regenerate
the mock interfaces used by the tests:

    cd libkbfs
    ./gen_mocks.sh

(Right now the mocks are checked into the repo; this isn't ideal and
we should probably change it.)
