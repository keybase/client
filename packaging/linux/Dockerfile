FROM debian
MAINTAINER Keybase <admin@keybase.io>

RUN apt-get update

# Install dependencies.
#   - Debian build requires 'fakeroot' and 'reprepro' (and 'dpkg-deb', but
#     that's installed by default).
#   - RPM build requires 'rpm' and 'createrepo'.
#   - The deploy scripts use 'git' to commit and push.
#   - 'curl' and 'wget' are for downloading Go and Node
#   - 'build-essential' pulls in gcc etc., which Go requires.
RUN apt-get update
RUN apt-get install -y fakeroot reprepro rpm createrepo git wget build-essential curl

# Install a recent version of Node.
RUN curl -sL https://deb.nodesource.com/setup_5.x | bash -
RUN apt-get update
RUN apt-get install -y nodejs awscli

# Install Go 1.5, which doesn't exist in the Ubuntu repos yet.
RUN wget https://storage.googleapis.com/golang/go1.5.1.linux-amd64.tar.gz -O /root/go.tar
RUN tar -C /usr/local -xzf /root/go.tar
RUN rm /root/go.tar
ENV PATH "$PATH:/usr/local/go/bin"
