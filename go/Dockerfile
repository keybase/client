FROM keybaseprivate/glibc
MAINTAINER Keybase <admin@keybase.io>

# Remove openssl once KBFSDocker changes are in
RUN apk add --update fuse jq bash openssl && \
    rm -rf /tmp/* /var/cache/apk/*

RUN adduser -D keybase && \
    mkdir /keybase && \
    chmod 777 /keybase && \
    mkdir -p /home/keybase && \
    chown keybase:keybase /home/keybase

USER keybase
WORKDIR /home/keybase

ENV KEYBASE_DEBUG=0 \
    KEYBASE_RUN_MODE=devel \
    KEYBASE_SERVER_URI="http://kbweb.local:3000" \
    KEYBASE_UPGRADE_PER_USER_KEY=1 \
    PATH=/home/keybase:$PATH

ADD keybase/keybase /home/keybase/keybase
ADD revision /home/keybase/client_revision
