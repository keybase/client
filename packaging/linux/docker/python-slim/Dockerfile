ARG BASE_IMAGE=keybaseio/client:latest
FROM $BASE_IMAGE AS base

FROM python:3.10-buster
LABEL maintainer="Keybase <admin@keybase.io>"

RUN apt-get update \
    && apt-get install -y gnupg2 procps ca-certificates \
    && rm -rf /var/lib/apt/lists/*

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

COPY --from=base /usr/bin/entrypoint.sh /usr/bin/entrypoint.sh
RUN chmod +x /usr/bin/entrypoint.sh

RUN useradd --create-home --shell /bin/bash keybase
VOLUME [ "/home/keybase/.config/keybase", "/home/keybase/.cache/keybase" ]

COPY --from=base /usr/bin/keybase /usr/bin/keybase
COPY --from=base /usr/bin/keybase.sig /usr/bin/keybase.sig

ENTRYPOINT ["/tini", "--", "entrypoint.sh"]
