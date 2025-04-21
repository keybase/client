# When updating the version, remember to bump keybase_packaging_v# in docker_build.sh.
FROM golang:1.23.4-bullseye
LABEL maintainer="Keybase <admin@keybase.io>"

# Install dependencies from the standard repos.
#   - Debian build requires 'fakeroot' and 'reprepro' (and 'dpkg-deb', but
#     that's installed by default).
#   - RPM build requires 'rpm' and 'createrepo'.
#   - The deploy scripts use 'git' to commit and push.
#   - 'curl' and 'wget' are for downloading Go and Node
#   - 'build-essential' pulls in gcc etc., which Go requires.
#   - gnupg1 to avoid a password issue in key import
#   - unzip because electron6 packager requires it
RUN apt-get update
RUN apt-get install -y fakeroot reprepro rpm createrepo-c git wget \
  build-essential curl s3cmd gnupg2 unzip rsync gcc-x86-64-linux-gnu

# Install nodejs and yarn. (Note that this depends on curl above.)
RUN mkdir -p /etc/apt/keyrings
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
ENV NODE_MAJOR=22
RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
RUN curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb http://dl.yarnpkg.com/debian/ stable main" > /etc/apt/sources.list.d/yarn.list
RUN apt-get update
RUN apt-get install -y nodejs yarn
