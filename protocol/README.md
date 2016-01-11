# Protocol

The protocol defines types and methods used in the Keybase API.

The protocol files are defined using [Avro IDL](http://avro.apache.org/docs/1.7.5/idl.html) in `avdl`.

To install dependencies for scripts: `make deps`.

To build stubs, run `make`.

Note that if you *delete* any AVDL files, you'll need to run
`make clean` or else the old generated results will stick around.
Likewise if you *add* and new AVDL files, there's a big list in the
Makefile that you'll need to manually insert your new file into.

## Pre-requisites on Linux (Ubuntu)

Install a recent version of build of nodejs:

    curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
    sudo apt-get install -y nodejs npm
    gem install activesupport
