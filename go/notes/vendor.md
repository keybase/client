## go 1.5 vendor

All external dependencies now live in

    github.com/keybase/client/go/vendor

This complies with the Go 1.5 vendor experiment: golang.org/s/go15vendor

I used govendor to help with this:

    https://github.com/kardianos/govendor

### Building keybase client:

    go get github.com/keybase/client/go
    GO15VENDOREXPERIMENT=1 go install github.com/keybase/client/go/keybase

No external dependencies required.

Without the environment variable set, it will use the
packages in your GOPATH like normal.

### Adding an external dependency

If you add a new external dependency, vendor it with:

    GO15VENDOREXPERIMENT=1 govendor add github.com/kr/pretty

### Updating an external dependency

If you'd like to update the vendored version of a
package:

    GO15VENDOREXPERIMENT=1 govendor update github.com/keybase/go-jsonw

### Removing an external dependency

    GO15VENDOREXPERIMENT=1 govendor remove github.com/codegangsta/cli

### Notes

The `keybase/client/protocol/go` package is an external
package.  Since it uses external packages that
`keybase/client/go` also uses, it had to be placed in
vendor as well.

If you change the protocol, you need to run this:

    cd $GOPATH/github.com/keybase/client/go
    GO15VENDOREXPERIMENT=1 govendor update github.com/keybase/client/protocol/go

I tried to get around this, but it is necessary.

