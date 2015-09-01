FROM ubuntu:14.04
MAINTAINER Keybase <admin@keybase.io>

VOLUME /keybase/bin
VOLUME /keybase/socket

ADD test/start_daemon_in_container.sh /start_daemon.sh

RUN useradd -m keybase
USER keybase
ENV KEYBASE_RUN_MODE devel
ENV KEYBASE_SOCKET_FILE /keybase/socket/keybase.sock
ENV KEYBASE_DEBUG true
ENV PATH=$PATH:/keybase/bin

CMD /start_daemon.sh
