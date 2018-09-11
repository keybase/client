# stellarnet

## Testing

This package uses the [vcr](https://github.com/keybase/vcr) package to record http responses.  Running

    go test

will use the pre-recorded responses to the stellar horizon requests.

To run against the test horizon servers:

    go test -live

To record new responses from the test horizon servers:

    go test -record

This makes `go test` very fast (0.02s) as it doesn't hit the network at all.
Currently, `go test -live` or `go test -record` takes 20s.
