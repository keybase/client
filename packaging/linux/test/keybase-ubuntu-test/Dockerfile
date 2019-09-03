FROM ubuntu
MAINTAINER Keybase <admin@keybase.io>

RUN apt-get update

# Install dependencies for keybase
RUN apt-get install -y libappindicator1 fuse libgconf-2-4 psmisc procps lsof

# Nice to have
RUN apt-get install -y vim less curl sudo

run useradd -m kb -G sudo -s /bin/bash -p $(echo pw | openssl passwd -1 -stdin)
run echo "alias dlnightly='curl -o https://prerelease.keybase.io/nightly/keybase_amd64.deb'\nalias dlrelease='curl -o https://prerelease.keybase.io/keybase_amd64.deb'" >> /home/kb/.bashrc
