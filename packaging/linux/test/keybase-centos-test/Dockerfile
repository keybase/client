FROM centos
MAINTAINER Keybase <admin@keybase.io>

# Install dependencies for keybase
RUN yum install -y at fuse libXScrnSaver.x86_64 initscripts psmisc procps lsof

# Nice to have
RUN yum install -y vim less curl sudo

RUN useradd -m kb
RUN echo kb:pw | chpasswd
RUN chsh -s /bin/bash kb
RUN usermod -aG wheel kb
RUN echo "alias dlnightly='curl -O https://prerelease.keybase.io/nightly/keybase_amd64.rpm'" >> /home/kb/.bashrc
RUN echo "alias dlrelease='curl -O https://prerelease.keybase.io/keybase_amd64.rpm'" >> /home/kb/.bashrc
