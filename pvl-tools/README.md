# PVL Tools

The proof verification language describes how clients should check remote proofs. For more information see https://keybase.io/docs/client/pvl_spec.

This directory contains tools for converting pvl from cson into a useable form.

To load `pvl.cson` into hardcoded Go, do this:
```sh
yarn
yarn run build
```

For other stuff try:
```sh
./reader.iced --help
```
