FROM solita/ubuntu-systemd
MAINTAINER Keybase <admin@keybase.io>

RUN apt-get update

# Install dependencies for keybase
RUN apt-get install -y libappindicator1 fuse libgconf-2-4 psmisc procps lsof

# Nice to have
RUN apt-get install -y vim less curl

