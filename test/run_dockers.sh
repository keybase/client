#!/bin/bash
# Requires docker >=1.9.1 and docker-compose >=1.6.2

TIMEOUT=60

while [[ $# > 1 ]]
do
key="$1"

case $key in
    -t|--timeout)
    TIMEOUT=$2
    shift # past argument
    ;;
    *)
            # unknown option
    ;;
esac
shift # past argument or value
done

echo "$(date) - launching dockers..."
docker-compose up -d

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
