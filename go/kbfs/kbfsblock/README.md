## kbfsblock

Types and functions to work with KBFS blocks. The package is named
`kbfsblock` rather than `block` to avoid clashes with existing
variable names.

All errors returned by this package are wrapped with pkg/errors, and
so need errors.Cause() to unwrap them.
