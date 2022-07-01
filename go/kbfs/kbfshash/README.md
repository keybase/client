## kbfshash

The Keybase hash type. The package is named `kbfshash` rather than
`hash` for two reasons:

1. To avoid conflicting with the `hash` package.
2. Variables may also be named `hash`.

All errors returned by this package are wrapped with pkg/errors, and
so need errors.Cause() to unwrap them.
