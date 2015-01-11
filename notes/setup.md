
# How To Setup And Run The Client

1. Install go1.3.2 (when we start dealing with Fuse, the Fuse bindings need 1.3.2)
1. Make a go working directory, `GOPATH=$HOME/src/go`.  Of course you can tweak as desired, but you should export GOPATH since go needs it.
1. mkdir -p $GOPATH/src/github.com/keybase
1. cd $GOPATH/src/github.com/keybase
1. git clone git@github.com:keybase/go-client
1. git clone git@github.com:keybase/go-libkb
1. cd go-client
1. go get # gets all external dependency code, like the crypto library and `codegangsta/cli`
1. go build # build everything
1 ./go-client --debug help
1. ./go-client --debug version 
