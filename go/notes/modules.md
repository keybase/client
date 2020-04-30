## Go Modules

### Adding an external dependency

> The go command resolves imports by using the specific dependency module
> versions listed in go.mod. When it encounters an import of a package not
> provided by any module in go.mod, the go command automatically looks up the
> module containing that package and adds it to go.mod, using the latest
> version.
Source: https://github.com/golang/go/wiki/Modules

or add a specific version/commit of a dependency

    go get github.com/keybase/go-jsonw@272f108028b0c2328335c35701f2c1ca78ac2320

### Updating an external dependency

    go get -u github.com/keybase/go-jsonw

or to a specific version/commit

    go get -u github.com/keybase/go-jsonw@df90f282c233fcb771aa004d3b8a30caadbc6fb3

`go get -u` will update the modules subdependencies, remove the `-u` flag if
that is not desired.

### Removing unused external dependencies

    go mod tidy

### Test with a local clone of a dependency

    go mod edit -replace github.com/keybase/go-jsonw=../go-jsonw

This command modifies the `go.mod` file, be sure to remove it before commiting
or merging.
