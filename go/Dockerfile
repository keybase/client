FROM ubuntu:14.04
MAINTAINER Keybase <admin@keybase.io>

RUN apt-get update && apt-get install -y fuse openssl jq

RUN useradd -m keybase
RUN mkdir /keybase
RUN chown keybase:keybase /keybase
USER keybase
WORKDIR /home/keybase
ADD keybase/keybase /home/keybase/keybase

ENV KEYBASE_DEBUG=0
ENV KEYBASE_RUN_MODE=devel
ENV KEYBASE_SERVER_URI="http://kbweb.local:3000"
ENV KBFS_DYNAMO_SERVER_ADDR="http://dynamodb.kbfs.local:8000"
ENV PATH=/opt/scripts:/home/keybase:$PATH
