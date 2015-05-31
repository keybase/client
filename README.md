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
        ln -s $GOPATH/src/github.com/keybase/client/git-hooks/pre-commit $GOPATH/src/github.com/keybase/kbfs/.git/hooks/
        go get -u github.com/golang/lint/golint
        go get golang.org/x/tools/cmd/vet

* Run the daemon

        rm -rf ~/kbtest
        cd daemon
        ./daemon -d -H ~/kbtest -s http://localhost:3000
* Sign up one (or more) users in a different terminal

        cd client
        ./client -H ~/kbtest signup

Now, in kbfs/:

    go get -u ./...
    ln -s $GOPATH/src/github.com/keybase/client/git-hooks/pre-commit .git/pre-commit
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

If you change anything in interfaces.go, you will have to regenerate
the mock interfaces used by the tests:

    cd libkbfs
    ./gen_mocks.sh

(Right now the mocks are checked into the repo; this isn't ideal and
we should probably change it.)

# Backend integration tests

First, make sure you have these prereqs:
    sudo apt-get install openjdk-7-jre
    go get github.com/mattn/go-sqlite3

From bserver/:
	make test

	Caveats: One needs to have a local KB webserver running (backend need to connect to localhost:44003 to verify user session)
        One also need to have logged into a KB daemon (from whom I obtain the client session token and send to the backend server)

# Testing with docker

For testing, it is often useful to bring up the Keybase daemon in a
clean environment, potentially multiple copies of it at once for
different users.  To do this, first build docker images for both
keybase and keybase/client if you haven't already:

    cd <keybase repo root>
    docker build -t kbweb .
    cd $GOPATH/src/github.com/keybase/client/go
    go install ./...
    docker build -t kbdaemon .

Now you can set up your test environment.  Let's say you want to be
logged in as two users:

    cd $GOPATH/src/github.com/keybase/kbfs/
    go build ./...
    ./setup_multiuser_test.sh 2

Now you have a webserver running, and two logged-in users.  To act as user1:

    ./switch_to_user_env.sh 1
    . /tmp/user1.env

Now you have KBFS mounted at /tmp/kbfs, acting as user 1.  This user's
Keybase user name is $KBUSER, and you can access the usernames of the
other user via $KBUSER2.

    ls /tmp/kbfs/$KBUSER
    echo "private" > /tmp/kbfs/$KBUSER/private
    echo "shared" > /tmp/kbfs/$KBUSER1,$KBUSER2/shared

Now you can switch to user2 and read the shared file you just created,
but not the private file

    ./switch_to_user_env.sh 2
    . /tmp/user2.env
    cat /tmp/kbfs/$KBUSER1,$KBUSER2/shared  # succeeds
    cat /tmp/kbfs/$KBUSER1/private  # fails!

NOTE: Until the backend server integration is ready, we can only have
one user running at a time (because the local backend uses leveldb,
which only supports one user at a time).

When you are done testing, you can nuke your environment:

    ./nuke_multiuser_test.sh 2

