# Protocol

The protocol defines types and methods used to communicate between KBFS and
other services.

The protocol files are defined using [Avro
IDL](http://avro.apache.org/docs/1.7.5/idl.html) in `avdl`.

The included Makefile assumes that the AVDLs are stored in the following
directory structure:
* service1service2-avdl/
  * foo.avdl
  * bar.avdl

The AVDL files will be compiled into Go files, which will be placed in the
following directory structure:
* ../protocol/service1service2/
  * foo.go
  * bar.go

To install dependencies for scripts: `make deps`.

To build Go stubs, run `make`.

Note that if you *delete* any AVDL files, you'll need to run `make clean` first
or else the old generated results will stick around.

## Pre-requisites on Linux (Ubuntu)

Install a recent version of build of nodejs:

    curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
    sudo apt-get install -y nodejs npm
    gem install activesupport
