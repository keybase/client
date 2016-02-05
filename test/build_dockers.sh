#!/bin/bash
# Requires docker 1.9

# Ensure that the keybase API is checked out
# go get -u -t github.com/keybase/keybase

# Ensure that the keybase client is checked out
# go get -u -t github.com/keybase/client

# Only build dockers if they don't already exist
if [ -z "$(docker images -q kbweb)" ]; then
    docker build -t kbweb $GOPATH/src/github.com/keybase/keybase
fi
if [ -z "$(docker images -q dynamodb)" ]; then
    docker build -t dynamodb -f $GOPATH/src/github.com/keybase/kbfs/test/Dockerfile_dynamodb $GOPATH/src/github.com/keybase/kbfs/test/
fi
if [ -z "$(docker images -q kbserver)" ]; then
    docker build -t kbserver -f $GOPATH/src/github.com/keybase/kbfs/test/Dockerfile_kbserver $GOPATH/src/github.com/keybase/kbfs/test/
fi
if [ -z "$(docker images -q keybase)" ]; then
    docker build -t keybase $GOPATH/src/github.com/keybase/client/go
fi
