FROM ubuntu
MAINTAINER Keybase <admin@keybase.io>

RUN apt-get update

# Install dependencies for keybase
RUN apt-get install -y libappindicator1 fuse libgconf-2-4 psmisc procps lsof

# Nice to have
RUN apt-get install -y vim less curl sudo

RUN useradd -m kb
RUN echo kb:pw | chpasswd
RUN chsh -s /bin/bash kb
RUN usermod -aG sudo kb
RUN echo "alias dlnightly='curl -O https://prerelease.keybase.io/nightly/keybase_amd64.deb'" >> /home/kb/.bashrc
RUN echo "alias dlrelease='curl -O https://prerelease.keybase.io/keybase_amd64.deb'" >> /home/kb/.bashrc
