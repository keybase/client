#!/bin/bash
# Requires docker 1.9

# Ensure that the keybase API is checked out
go get -u -t github.com/keybase/keybase 2>/dev/null

# Only build dockers if they don't already exist
if [ -z "$(docker images -q kbweb)" ]; then
    docker build -t kbweb $GOPATH/src/github.com/keybase/keybase
fi
if [ -z "$(docker images -q dynamodb)" ]; then
    docker build -t dynamodb dynamodb
fi
if [ -z "$(docker images -q mdserver)" ]; then
    docker build -t mdserver mdserver
fi
if [ -z "$(docker images -q bserver)" ]; then
    docker build -t bserver bserver
fi
