FROM ubuntu:14.04
MAINTAINER Keybase <admin@keybase.io>

RUN useradd -m keybase
USER keybase
WORKDIR /home/keybase

ENV KEYBASE_DEBUG=1
ENV KEYBASE_RUN_MODE=devel
ENV KEYBASE_SERVER_URI="http://kbweb:3000"
ENV KBFS_DYNAMO_SERVER_ADDR="http://dynamodb:8000"
ENV PATH=/opt/keybase:$PATH

ENTRYPOINT ["/opt/keybase/keybase", "service"]
