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

KBWEB_DOCKER="$(docker run -d -p 3000:3000 kbweb)"
KEYBASE_API_ADDR="http://$(docker inspect $KBWEB_DOCKER | jq -r '.[0].NetworkSettings.Networks.bridge.IPAddress'):3000"

DYNAMODB_DOCKER="$(docker run -d --expose 8000 dynamodb)"
DYNAMODB_ADDR="http://$(docker inspect $DYNAMODB_DOCKER | jq -r '.[0].NetworkSettings.Networks.bridge.IPAddress'):8000"

MDSERVER_DOCKER="$(docker run -d -p 8125:8125 -e KBFS_DYNAMO_SERVER_ADDR=$DYNAMODB_ADDR -e KEYBASE_SERVER_URI=$KEYBASE_API_ADDR -v $GOPATH/bin:/opt/keybase:ro mdserver)"
MDSERVER_ADDR="http://$(docker inspect $MDSERVER_DOCKER | jq -r '.[0].NetworkSettings.Networks.bridge.IPAddress'):8125"

BSERVER_DOCKER="$(docker run -d -p 8225:8225 -e KBFS_DYNAMO_SERVER_ADDR=$DYNAMODB_ADDR -e KEYBASE_SERVER_URI=$KEYBASE_API_ADDR -v $GOPATH/bin:/opt/keybase:ro bserver)"
BSERVER_ADDR="http://$(docker inspect $BSERVER_DOCKER | jq -r '.[0].NetworkSettings.Networks.bridge.IPAddress'):8225"

echo "KEYBASE_API_ADDR=$KEYBASE_API_ADDR"
echo "DYNAMODB_ADDR=$DYNAMODB_ADDR"
echo "MDSERVER_ADDR=$MDSERVER_ADDR"
echo "BSERVER_ADDR=$BSERVER_ADDR"
echo "KBWEB_DOCKER=$KBWEB_DOCKER"
echo "DYNAMODB_DOCKER=$DYNAMODB_DOCKER"
echo "MDSERVER_DOCKER=$MDSERVER_DOCKER"
echo "BSERVER_DOCKER=$BSERVER_DOCKER"
