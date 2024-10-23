ARG BASE_IMAGE=keybaseio/client:alpine

FROM $BASE_IMAGE AS base

FROM alpine:3
LABEL maintainer="Keybase <admin@keybase.io>"

RUN apk add --update --no-cache gnupg procps ca-certificates bash

ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini.asc /tini.asc
COPY packaging/linux/docker/tini_key.asc /tini_key.asc
RUN gpg --import /tini_key.asc \
    && rm /tini_key.asc \
    && gpg --batch --verify /tini.asc /tini \
    && chmod +x /tini

ENV GOSU_VERSION 1.11
ADD https://github.com/tianon/gosu/releases/download/${GOSU_VERSION}/gosu-amd64 /usr/local/bin/gosu
ADD https://github.com/tianon/gosu/releases/download/${GOSU_VERSION}/gosu-amd64.asc /usr/local/bin/gosu.asc
COPY packaging/linux/docker/gosu_key.asc /gosu_key.asc
RUN gpg --import /gosu_key.asc \
    && rm /gosu_key.asc \
    && gpg --batch --verify /usr/local/bin/gosu.asc /usr/local/bin/gosu \
    && chmod +x /usr/local/bin/gosu

COPY packaging/linux/docker/slim/entrypoint.sh /usr/bin/entrypoint.sh
RUN chmod +x /usr/bin/entrypoint.sh

RUN adduser --disabled-password --gecos "" --shell /bin/bash keybase
VOLUME [ "/home/keybase/.config/keybase", "/home/keybase/.cache/keybase" ]

COPY --from=base /usr/bin/keybase /usr/bin/keybase
COPY --from=base /usr/bin/keybase.sig /usr/bin/keybase.sig

ENTRYPOINT ["/tini", "--", "entrypoint.sh"]
