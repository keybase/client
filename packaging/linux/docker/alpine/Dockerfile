FROM alpine:3.21
LABEL maintainer="Keybase <admin@keybase.io>"

RUN apk add --update --no-cache gnupg procps ca-certificates bash

ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /usr/local/bin/tini
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini.asc /usr/local/bin/tini.asc
COPY packaging/linux/docker/tini_key.asc /tini_key.asc
RUN gpg --import /tini_key.asc \
    && rm /tini_key.asc \
    && gpg --batch --verify /usr/local/bin/tini.asc /usr/local/bin/tini \
    && chmod +x /usr/local/bin/tini

ENV GOSU_VERSION 1.11
ADD https://github.com/tianon/gosu/releases/download/${GOSU_VERSION}/gosu-amd64 /usr/local/bin/gosu
ADD https://github.com/tianon/gosu/releases/download/${GOSU_VERSION}/gosu-amd64.asc /usr/local/bin/gosu.asc
COPY packaging/linux/docker/gosu_key.asc /gosu_key.asc
RUN gpg --import /gosu_key.asc \
    && rm /gosu_key.asc \
    && gpg --batch --verify /usr/local/bin/gosu.asc /usr/local/bin/gosu \
    && chmod +x /usr/local/bin/gosu

COPY packaging/linux/docker/standard/entrypoint.sh /usr/bin/entrypoint.sh
RUN chmod +x /usr/bin/entrypoint.sh

RUN adduser --disabled-password --gecos "" --shell /bin/bash keybase
VOLUME [ "/home/keybase/.config/keybase", "/home/keybase/.cache/keybase" ]

ADD .docker/binaries/amd64/keybase /usr/bin/keybase
ADD .docker/binaries/amd64/keybase.sig /usr/bin/keybase.sig
ADD .docker/binaries/amd64/kbfsfuse /usr/bin/kbfsfuse
ADD .docker/binaries/amd64/kbfsfuse.sig /usr/bin/kbfsfuse.sig
ADD .docker/binaries/amd64/git-remote-keybase /usr/bin/git-remote-keybase
ADD .docker/binaries/amd64/git-remote-keybase.sig /usr/bin/git-remote-keybase.sig

ENTRYPOINT ["tini", "--", "entrypoint.sh"]
