# Bookworm (glibc 2.36): Debian 12 / Ubuntu 24.04+. Older distros will not run these binaries.
# When updating this file, bump keybase_packaging_v# in docker_build.sh.
FROM debian:bookworm
LABEL maintainer="Keybase <admin@keybase.io>"

# Install dependencies from the standard repos.
#   - Debian build requires 'fakeroot' and 'reprepro' (and 'dpkg-deb', but
#     that's installed by default).
#   - RPM build requires 'rpm' and 'createrepo'.
#   - The deploy scripts use 'git' to commit and push.
#   - 'curl' and 'wget' are for downloading Go and Node
#   - 'build-essential' pulls in gcc etc., which Go requires.
#   - unzip because electron packager requires it
RUN apt-get update \
  && apt-get install -y fakeroot reprepro rpm createrepo-c git wget \
    build-essential curl s3cmd gnupg gnupg2 unzip rsync gcc-x86-64-linux-gnu ca-certificates \
  && rm -rf /var/lib/apt/lists/*

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

# Install nodejs and Yarn classic (shared/yarn.lock is v1). Node 25+ no longer
# ships corepack, so Yarn is downloaded directly and pinned by sha256.
RUN mkdir -p /etc/apt/keyrings \
  && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
ENV NODE_MAJOR=26
RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
  && apt-get update \
  && apt-get install -y nodejs \
  && rm -rf /var/lib/apt/lists/*

RUN wget -q https://github.com/yarnpkg/yarn/releases/download/v1.22.22/yarn-v1.22.22.tar.gz -O /tmp/yarn.tar.gz \
  && echo "88268464199d1611fcf73ce9c0a6c4d44c7d5363682720d8506f6508addf36a0  /tmp/yarn.tar.gz" | sha256sum --check --strict \
  && tar -C /opt -xzf /tmp/yarn.tar.gz \
  && rm /tmp/yarn.tar.gz
ENV PATH="/opt/yarn-v1.22.22/bin:${PATH}"
