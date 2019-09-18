FROM golang:1.12.4-stretch AS builder

ARG SOURCE_COMMIT=unknown

ARG SIGNING_FINGERPRINT
COPY .docker/code_signing_key /code_signing_key
RUN gpg --import /code_signing_key

COPY . /go/src/github.com/keybase/client
RUN SOURCE_COMMIT=${SOURCE_COMMIT} \
    KEYBASE_NO_GUI=1 \
    KEYBASE_SKIP_32_BIT=1 \
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

COPY packaging/linux/docker/standard/entrypoint.sh /usr/bin/entrypoint.sh
RUN chmod +x /usr/bin/entrypoint.sh

RUN useradd --create-home --shell /bin/bash keybase \
    && mkdir -p /var/log/keybase \
    && chown keybase:keybase /var/log/keybase
USER keybase
VOLUME [ "/home/keybase/.config/keybase", "/home/keybase/.local/share/keybase" ]

COPY --from=builder /binaries/amd64/usr/bin/keybase /usr/bin/keybase
COPY --from=builder /binaries/amd64/usr/bin/keybase.sig /usr/bin/keybase.sig
COPY --from=builder /binaries/amd64/usr/bin/kbfsfuse /usr/bin/kbfsfuse
COPY --from=builder /binaries/amd64/usr/bin/kbfsfuse.sig /usr/bin/kbfsfuse.sig
COPY --from=builder /binaries/amd64/usr/bin/git-remote-keybase /usr/bin/git-remote-keybase
COPY --from=builder /binaries/amd64/usr/bin/git-remote-keybase.sig /usr/bin/git-remote-keybase.sig

ENTRYPOINT ["/tini", "--", "entrypoint.sh"]
