# Bookworm (glibc 2.36): Debian 12 / Ubuntu 24.04+. Older distros will not run these binaries.
FROM debian:bookworm AS builder

ARG SOURCE_COMMIT=unknown

ARG SIGNING_FINGERPRINT
COPY .docker/code_signing_key /code_signing_key

RUN apt-get update \
  && apt-get install -y gcc-x86-64-linux-gnu wget gnupg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN gpg --import /code_signing_key

RUN arch="$(dpkg --print-architecture)" \
  && case "$arch" in \
      amd64) sha=63d339f0da5ab53635a56f2490a7984dfe12dfcff22ad749f63edaf590168445 ;; \
      arm64) sha=3450b45a3f9ee8568792736a5c5e70a1f2e9b36c35a8f74958c03e51d7d92bec ;; \
      *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
    esac \
  && wget -q "https://go.dev/dl/go1.27.1.linux-${arch}.tar.gz" -O /tmp/go.tar.gz \
  && echo "$sha  /tmp/go.tar.gz" | sha256sum --check --strict \
  && tar -C /usr/local -xzf /tmp/go.tar.gz \
  && rm /tmp/go.tar.gz

ENV PATH="/usr/local/go/bin:${PATH}"
ENV GOPATH="/go"
ENV PATH="${GOPATH}/bin:${PATH}"

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
