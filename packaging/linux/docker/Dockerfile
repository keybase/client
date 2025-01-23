FROM golang:1.23.4-bullseye AS builder

ARG SOURCE_COMMIT=unknown

ARG SIGNING_FINGERPRINT
COPY .docker/code_signing_key /code_signing_key
RUN gpg --import /code_signing_key

RUN apt-get update 
RUN apt-get install -y gcc-x86-64-linux-gnu

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

