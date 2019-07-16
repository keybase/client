# This Dockerfile results in a simple Docker image with
# a statically compiled Keybase binary in /usr/bin/keybase.
FROM golang:1.12.4-stretch AS builder
LABEL maintainer="Keybase <admin@keybase.io>"

ENV KEYBASE_SKIP_32_BIT=1

COPY . /go/src/github.com/keybase/client
RUN /go/src/github.com/keybase/client/packaging/linux/build_binaries.sh \
    production /
RUN chmod +x /binaries/amd64/usr/bin/keybase

FROM debian:10

RUN apt-get update \
    && apt-get install -y gnupg2 \
    && rm -rf /var/lib/apt/lists/*

ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini.asc /tini.asc
RUN gpg --batch --keyserver hkp://p80.pool.sks-keyservers.net:80 --recv-keys 595E85A6B1B4779EA4DAAEC70B588DFF0527A9B7 \
    && gpg --batch --verify /tini.asc /tini \
    && chmod +x /tini

RUN useradd --create-home --shell /bin/bash keybase
USER keybase

COPY --from=builder /binaries/amd64/usr/bin/keybase /usr/bin/keybase

ENTRYPOINT ["/tini", "--"]
CMD ["keybase", "service"]
