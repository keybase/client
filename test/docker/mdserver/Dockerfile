FROM ubuntu:14.04
MAINTAINER Keybase <admin@keybase.io>

ENV KEYBASE_DEBUG=1
ENV KEYBASE_RUN_MODE=devel
ENV KBFS_BIND_ADDR="0.0.0.0:8125"
ENV KEYBASE_SERVER_URI="http://kbweb:3000"
ENV KBFS_DYNAMO_SERVER_ADDR="http://dynamodb:8000"

ENTRYPOINT ["/opt/keybase/mdserver"]
