FROM debian:stretch
LABEL maintainer="Keybase <admin@keybase.io>"

# Install dependencies from the standard repos.
#   - Debian build requires 'fakeroot' and 'reprepro' (and 'dpkg-deb', but
#     that's installed by default).
#   - RPM build requires 'rpm' and 'createrepo'.
#   - The deploy scripts use 'git' to commit and push.
#   - 'curl' and 'wget' are for downloading Go and Node
#   - 'build-essential' pulls in gcc etc., which Go requires.
#   - python and pip for recent versions of s3cmd
#   - gnupg1 to avoid a password issue in key import
#   - unzip because electron6 packager requires it
RUN apt-get update
RUN apt-get install -y fakeroot reprepro rpm createrepo git wget \
  build-essential curl python python-pip gnupg1 unzip

# Install s3cmd. See this issue for why we need a version newer than what's in
# the Debian repos: https://github.com/s3tools/s3cmd/issues/437
RUN pip install s3cmd

# Install nodejs and yarn. (Note that this depends on curl above.)
RUN curl -sL https://deb.nodesource.com/setup_16.x | bash -
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb http://dl.yarnpkg.com/debian/ stable main" > /etc/apt/sources.list.d/yarn.list
RUN apt-get update
RUN apt-get install -y nodejs yarn

# Install Go directly from Google, because the Debian repos tend to be behind.
# When updating the version, remember to bump keybase_packaging_v# in docker_build.sh.
# Copy over the new hash when upgrading version. But if not upgrading version,
# the check should not ever fail.
ENV GOLANG_VERSION 1.19.4
ENV GOLANG_DOWNLOAD_URL https://dl.google.com/go/go$GOLANG_VERSION.linux-amd64.tar.gz
ENV GOLANG_DOWNLOAD_SHA256 c9c08f783325c4cf840a94333159cc937f05f75d36a8b307951d5bd959cf2ab8
RUN wget "$GOLANG_DOWNLOAD_URL" -O /root/go.tar.gz
RUN echo "$GOLANG_DOWNLOAD_SHA256 /root/go.tar.gz" | sha256sum --check --status --strict -
RUN tar -C /usr/local -xzf /root/go.tar.gz
RUN rm /root/go.tar.gz
ENV PATH "$PATH:/usr/local/go/bin"
