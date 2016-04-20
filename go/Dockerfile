FROM alpine:3.3
MAINTAINER Keybase <admin@keybase.io>

RUN apk add --update fuse jq bash && \
    rm -rf /var/cache/apk/* && \
    mkdir -p /home/keybase && \
    mkdir /keybase && \
    adduser -D keybase && \
    chown keybase:keybase /keybase

USER keybase
WORKDIR /home/keybase

ENV KEYBASE_DEBUG=0 \
    KEYBASE_RUN_MODE=devel \
    KEYBASE_SERVER_URI="http://kbweb.local:3000" \
    PATH=/home/keybase:$PATH

ADD keybase/keybase /home/keybase/keybase
