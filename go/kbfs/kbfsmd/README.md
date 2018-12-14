## kbfsmd

Types and functions to work with KBFS blocks. The package is named
`kbfsmd` rather than `md` to avoid clashes with existing
variable names.

All errors returned by this package are wrapped with pkg/errors, and
so need errors.Cause() to unwrap them.
