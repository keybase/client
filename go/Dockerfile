FROM keybaseprivate/glibc
MAINTAINER Keybase <admin@keybase.io>

# Remove openssl once KBFSDocker changes are in
RUN apk add --update fuse jq bash openssl && \
    adduser -D keybase && \
    mkdir /keybase && \
    chmod 777 /keybase && \
    mkdir -p /home/keybase && \
    chown keybase:keybase /home/keybase && \
    rm -rf /tmp/* /var/cache/apk/*

USER keybase
WORKDIR /home/keybase

ENV KEYBASE_DEBUG=1 \
    KEYBASE_RUN_MODE=devel \
    KEYBASE_SERVER_URI="http://kbweb.local:3000" \
    PATH=/home/keybase:$PATH

ADD keybase/keybase /home/keybase/keybase
ADD revision /home/keybase/client_revision
