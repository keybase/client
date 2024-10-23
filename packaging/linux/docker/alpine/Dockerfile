FROM golang:1.21.6-alpine3.19 AS builder

RUN apk add --update --no-cache gnupg bash build-base

ARG SOURCE_COMMIT=unknown

ARG SIGNING_FINGERPRINT
COPY .docker/code_signing_key /code_signing_key
RUN gpg --import /code_signing_key

COPY . /go/src/github.com/keybase/client
RUN SOURCE_COMMIT=${SOURCE_COMMIT} \
    KEYBASE_NO_GUI=1 \
    /go/src/github.com/keybase/client/packaging/linux/build_binaries.sh \
    prerelease /
RUN gpg --detach-sign --armor --use-agent --local-user "$SIGNING_FINGERPRINT" \
    -o "/binaries/amd64/usr/bin/keybase.sig" /binaries/amd64/usr/bin/keybase && \
    gpg --detach-sign --armor --use-agent --local-user "$SIGNING_FINGERPRINT" \
    -o "/binaries/amd64/usr/bin/kbfsfuse.sig" /binaries/amd64/usr/bin/kbfsfuse && \
    gpg --detach-sign --armor --use-agent --local-user "$SIGNING_FINGERPRINT" \
    -o "/binaries/amd64/usr/bin/git-remote-keybase.sig" /binaries/amd64/usr/bin/git-remote-keybase
RUN chmod +x /binaries/amd64/usr/bin/keybase \
    && chmod +x /binaries/amd64/usr/bin/kbfsfuse \
    && chmod +x /binaries/amd64/usr/bin/git-remote-keybase

FROM alpine:3.20.3
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

COPY --from=builder /binaries/amd64/usr/bin/keybase /usr/bin/keybase
COPY --from=builder /binaries/amd64/usr/bin/keybase.sig /usr/bin/keybase.sig
COPY --from=builder /binaries/amd64/usr/bin/kbfsfuse /usr/bin/kbfsfuse
COPY --from=builder /binaries/amd64/usr/bin/kbfsfuse.sig /usr/bin/kbfsfuse.sig
COPY --from=builder /binaries/amd64/usr/bin/git-remote-keybase /usr/bin/git-remote-keybase
COPY --from=builder /binaries/amd64/usr/bin/git-remote-keybase.sig /usr/bin/git-remote-keybase.sig

ENTRYPOINT ["tini", "--", "entrypoint.sh"]
