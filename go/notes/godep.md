# How to use godep

The repo now uses [godep](https://github.com/tools/godep) to manage the dependencies of the packages.  

Now all the dependencies are in the repo in the Godeps directory.

## Initial setup

    $ go get github.com/tools/godep

## Basic usage

This assumes a `GOPATH` of `~/kb`:

    $ cd ~/kb/src/github.com/keybase/go
    $ godep go install ./...

or 

    $ godep go test ./...

etc.

## Add a dependency

To add a new package foo/bar, do this:

1. Run `go get foo/bar`
2. Edit your code to import foo/bar.
3. Run `godep save` (or `godep save ./...`).

## Update a Dependency

To update a package from your `$GOPATH`, do this:

1. Run `go get -u foo/bar`
2. Run `godep update foo/bar`. (You can use the `...` wildcard,
for example `godep update foo/...`).

Before committing the change, you'll probably want to inspect
the changes to Godeps, for example with `git diff`,
and make sure it looks reasonable.

## More

Full details at [https://github.com/tools/godep](https://github.com/tools/godep).
