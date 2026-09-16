FROM ubuntu:24.04
LABEL maintainer="Keybase <admin@keybase.io>"

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y fuse libfuse2t64 psmisc procps lsof vim less curl sudo openssl \
  && rm -rf /var/lib/apt/lists/*

RUN useradd -m kb -G sudo -s /bin/bash -p "$(openssl passwd -1 pw)"
RUN echo "alias dlnightly='curl -O https://prerelease.keybase.io/nightly/keybase_amd64.deb'\nalias dlrelease='curl -O https://prerelease.keybase.io/keybase_amd64.deb'" >> /home/kb/.bashrc
