FROM alpine:3.3
MAINTAINER Keybase <admin@keybase.io>

RUN apk add --update fuse openssl jq bash && \
    rm -rf /var/cache/apk/* && \
    mkdir -p /home/keybase && \
    mkdir /keybase && \
    adduser -D keybase && \
    chown keybase:keybase /keybase

USER keybase
WORKDIR /home/keybase
ADD keybase/keybase /home/keybase/keybase

ENV KEYBASE_DEBUG=0
ENV KEYBASE_RUN_MODE=devel
ENV KEYBASE_SERVER_URI="http://kbweb.local:3000"
ENV PATH=/home/keybase:$PATH
