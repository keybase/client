FROM alpine:3.3
MAINTAINER Keybase <admin@keybase.io>

# Remove openssl once KBFSDocker changes are in
RUN apk add --update wget ca-certificates fuse jq bash openssl && \
    cd /tmp && \
    wget "https://github.com/andyshinn/alpine-pkg-glibc/releases/download/2.23-r1/glibc-2.23-r1.apk" \
        "https://github.com/andyshinn/alpine-pkg-glibc/releases/download/2.23-r1/glibc-bin-2.23-r1.apk" && \
    apk add --allow-untrusted glibc-2.23-r1.apk glibc-bin-2.23-r1.apk && \
    echo 'hosts: files mdns4_minimal [NOTFOUND=return] dns mdns4' >> /etc/nsswitch.conf && \
    adduser -D keybase && \
    mkdir /keybase && \
    chmod 777 /keybase && \
    rm -rf /tmp/* /var/cache/apk/*

USER keybase
WORKDIR /home/keybase

ENV KEYBASE_DEBUG=0 \
    KEYBASE_RUN_MODE=devel \
    KEYBASE_SERVER_URI="http://kbweb.local:3000" \
    PATH=/home/keybase:$PATH

ADD keybase/keybase /home/keybase/keybase
ADD revision /home/keybase/client_revision
