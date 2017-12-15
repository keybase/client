# Build everything at least. This is a work in progress.
#
# Useful for testing things before a release.
#
# Will also be used for running the camlistore.org website and public
# read-only blobserver.

FROM ubuntu:12.04

MAINTAINER camlistore <camlistore@googlegroups.com>

ENV DEBIAN_FRONTEND noninteractive
RUN apt-get update && apt-get upgrade -y
RUN apt-get install -y curl make git

RUN curl -o /tmp/go.tar.gz https://storage.googleapis.com/golang/go1.3.1.linux-amd64.tar.gz
RUN tar -C /usr/local -zxvf /tmp/go.tar.gz
RUN rm /tmp/go.tar.gz
RUN /usr/local/go/bin/go version

ENV GOROOT /usr/local/go
ENV PATH $GOROOT/bin:/gopath/bin:$PATH

RUN mkdir -p /gopath/src
ADD pkg /gopath/src/camlistore.org/pkg
ADD cmd /gopath/src/camlistore.org/cmd
ADD website /gopath/src/camlistore.org/website
ADD third_party /gopath/src/camlistore.org/third_party
ADD server /gopath/src/camlistore.org/server
ADD dev /gopath/src/camlistore.org/dev
ADD depcheck /gopath/src/camlistore.org/depcheck

RUN adduser --disabled-password --quiet --gecos Camli camli
RUN mkdir -p /gopath/bin
RUN chown camli.camli /gopath/bin
RUN mkdir -p /gopath/pkg
RUN chown camli.camli /gopath/pkg
USER camli

ENV GOPATH /gopath

RUN go install --tags=purego \
    camlistore.org/server/camlistored \
    camlistore.org/cmd/camput \
    camlistore.org/cmd/camget \
    camlistore.org/cmd/camtool \
    camlistore.org/website \
    camlistore.org/dev/devcam

ENV USER camli
ENV HOME /home/camli
WORKDIR /home/camli

EXPOSE 80 443 3179 8080

CMD /bin/bash
