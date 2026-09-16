FROM jrei/systemd-ubuntu:24.04
LABEL maintainer="Keybase <admin@keybase.io>"

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y fuse libfuse2t64 psmisc procps lsof vim less curl \
  && rm -rf /var/lib/apt/lists/*
