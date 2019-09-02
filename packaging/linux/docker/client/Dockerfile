ARG SERVICE_IMAGE=keybaseio/service:latest

FROM $SERVICE_IMAGE AS base

FROM debian:stretch
LABEL maintainer="Keybase <admin@keybase.io>"

RUN apt-get update \
    && apt-get install -y gnupg2 procps \
    && rm -rf /var/lib/apt/lists/*

ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini.asc /tini.asc
COPY packaging/linux/docker/tini_key.asc /tini_key.asc
RUN gpg --import /tini_key.asc \
    && rm /tini_key.asc \
    && gpg --batch --verify /tini.asc /tini \
    && chmod +x /tini

RUN useradd --create-home --shell /bin/bash keybase
USER keybase

COPY --from=base /usr/bin/keybase /usr/bin/keybase
COPY --from=base /usr/bin/kbfsfuse /usr/bin/kbfsfuse
COPY --from=base /usr/bin/git-remote-keybase /usr/bin/git-remote-keybase

ENTRYPOINT ["/tini", "--"]
CMD ["keybase status"]
