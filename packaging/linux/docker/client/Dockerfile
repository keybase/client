# This Dockerfile results in a simple Docker image with
# a statically compiled Keybase binary in /usr/bin/keybase.
FROM golang:1.12.4-stretch AS builder
LABEL maintainer="Keybase <admin@keybase.io>"

ARG SOURCE_COMMIT=unknown

COPY . /go/src/github.com/keybase/client
RUN SOURCE_COMMIT=${SOURCE_COMMIT} \
    KEYBASE_NO_GUI=1 \
    KEYBASE_SKIP_32_BIT=1 \
    /go/src/github.com/keybase/client/packaging/linux/build_binaries.sh \
    prerelease /
RUN chmod +x /binaries/amd64/usr/bin/keybase \
    && chmod +x /binaries/amd64/usr/bin/kbfsfuse \
    && chmod +x /binaries/amd64/usr/bin/git-remote-keybase

FROM debian:stretch

RUN apt-get update \
    && apt-get install -y gnupg2 procps \
    && rm -rf /var/lib/apt/lists/*

ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini.asc /tini.asc
RUN gpg --batch --keyserver hkp://p80.pool.sks-keyservers.net:80 --recv-keys 595E85A6B1B4779EA4DAAEC70B588DFF0527A9B7 \
    && gpg --batch --verify /tini.asc /tini \
    && chmod +x /tini

USER keybase

COPY --from=builder /binaries/amd64/usr/bin/keybase /usr/bin/keybase
COPY --from=builder /binaries/amd64/usr/bin/kbfsfuse /usr/bin/kbfsfuse
COPY --from=builder /binaries/amd64/usr/bin/git-remote-keybase /usr/bin/git-remote-keybase

ENTRYPOINT ["/tini", "--"]
CMD ["keybase status"]
