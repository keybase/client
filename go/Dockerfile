FROM alpine:3.3
MAINTAINER Keybase <admin@keybase.io>

RUN apk add --update wget ca-certificates fuse jq bash && \
    cd /tmp && \
    wget "https://circle-artifacts.com/gh/andyshinn/alpine-pkg-glibc/6/artifacts/0/home/ubuntu/alpine-pkg-glibc/packages/x86_64/glibc-2.21-r2.apk" \
         "https://circle-artifacts.com/gh/andyshinn/alpine-pkg-glibc/6/artifacts/0/home/ubuntu/alpine-pkg-glibc/packages/x86_64/glibc-bin-2.21-r2.apk" && \
    apk add --allow-untrusted glibc-2.21-r2.apk glibc-bin-2.21-r2.apk && \
    /usr/glibc/usr/bin/ldconfig /lib /usr/glibc/usr/lib && \
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
