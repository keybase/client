## kbfscrypto

Crypto-related types and functions for KBFS. The package is named
`kbfscrypto` rather than `crypto` for two reasons:

1. To avoid conflicting with the `crypto` package.
2. Some variables are named `crypto` already.

All errors returned by this package are wrapped with pkg/errors, and
so need errors.Cause() to unwrap them.
