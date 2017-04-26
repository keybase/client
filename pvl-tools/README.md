# PVL Tools

The proof verification language describes how clients should check remote proofs. For more information see https://keybase.io/docs/client/pvl_spec.

This directory contains tools for converting pvl from cson into a pvl kit to upload. A `pvl_kit` is an object that contains a pvl chunk for each supported `pvl_version`. It is hashed into the sitewide merkle tree.

To build `kit.json` out of the files in `tab/*.cson` do this:
```sh
yarn
yarn run build
```

For other stuff try:
```sh
./tool.iced --help
```

Example `pvl_kit`:
```
{
  "kit_version": 1,
  "ctime": 1489075972,
  "tab": {
    "1": {
    "pvl_version": 1,
    "revision": 3,
    "services": {... etc ...}
    },
    "2": {
      "pvl_version": 2,
      "revision": 4,
      "services": {... etc ...}
    }
  }
}
```

- `kit_version` is 1. We can use this to signal a major to the kit format.
- `ctime` should be some time between when the kit was authored and when it was signed into the merkle tree for the first time. It is not used by the client.
- `tab` is a map from supported `pvl_version`s to their `pvl_chunk`. The key and `pvl_version` inside must match. Supporting multiple versions of the pvl interpreter may be necessary if there's a change to the spec. To disable older clients from checking proofs, drop their version's entry.

The files in `tab` are composed in CSON because it allows for comments and a little brevity. Everything downstream uses JSON.
