FROM debian
MAINTAINER Keybase <admin@keybase.io>

# Install dependencies from the standard repos.
#   - Debian build requires 'fakeroot' and 'reprepro' (and 'dpkg-deb', but
#     that's installed by default).
#   - RPM build requires 'rpm' and 'createrepo'.
#   - The deploy scripts use 'git' to commit and push.
#   - 'curl' and 'wget' are for downloading Go and Node
#   - 'build-essential' pulls in gcc etc., which Go requires.
#   - python and pip for recent versions of s3cmd
#   - libc6-dev-i386 for the i386 cgo part of the build
RUN apt-get update
RUN apt-get install -y fakeroot reprepro rpm createrepo git wget \
  build-essential curl python python-pip libc6-dev-i386

# Install s3cmd. See this issue for why we need a version newer than what's in
# the Debian repos: https://github.com/s3tools/s3cmd/issues/437
RUN pip install s3cmd

# Install nodejs and yarn. (Note that this depends on curl above.)
RUN curl -sL https://deb.nodesource.com/setup_6.x | bash -
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb http://dl.yarnpkg.com/debian/ stable main" > /etc/apt/sources.list.d/yarn.list
RUN apt-get update
RUN apt-get install -y nodejs yarn

# Install Go directly from Google, because the Debian repos tend to be behind.
RUN wget "https://storage.googleapis.com/golang/go1.8.3.linux-amd64.tar.gz" -O /root/go.tar
RUN tar -C /usr/local -xzf /root/go.tar
RUN rm /root/go.tar
ENV PATH "$PATH:/usr/local/go/bin"
