#!/bin/bash
# Requires docker >=1.9.1 and docker-compose >=1.6.2

TIMEOUT=60
USERS=1

while [[ $# > 1 ]]
do
key="$1"

case $key in
    -t|--timeout)
    TIMEOUT=$2
    shift # past argument
    ;;
    -u|--users)
    USERS=$2
    shift # past argument
    ;;
    -h|--help)
    echo "Usage: run_dockers.sh [-u|--users <number of users to create>] [-t|--timeout <timeout to wait for kbweb service>]"
    ;;
    *)
    # unknown option
    ;;
esac
shift # past argument or value
done

echo "$(date) - launching dockers..."
docker-compose up -d
docker-compose scale keybase=$USERS

echo "$(date) - waiting for kbweb to start..."
t=0
while ! curl -s -o /dev/null http://localhost:3000/
do
    if [ "$t" -gt "$TIMEOUT" ]; then
        echo "Timed out waiting for kbweb to start"
        docker-compose down
        exit 2
    fi
    sleep 1
    ((t++))
done
echo "$(date) - connected to kbweb successfully"

CONTAINERS=$(docker-compose ps -q keybase)

u=0
docker-compose ps -q keybase | while read c; do
    docker exec $c sh -c "keybase signup -c 202020202020202020202020 --email \"test$u@keyba.se\" --username \"test$u\" -p \"strong passphrase\" -d dev0 -b --devel 2>&1 >/dev/null"
    ((u++))
done
