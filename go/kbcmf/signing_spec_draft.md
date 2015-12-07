# Signing

## Properties
As with the encryption format, we want our signing format to have several
properties on top of a plain NaCl signature:
- Streaming. We want to be able to verify a message of any size, without
  fitting the whole thing in RAM, and without requiring a second pass to output
  attached plaintext.
- Abuse resistance. Alice might use the same signing key for many applications
  besides Sillybox. Mallory might [try to
  trick](https://blog.sandstorm.io/news/2015-05-01-is-that-ascii-or-protobuf.html)
  Alice into signing messages that are meaningful to other applications. Alice
  should avoid signing any bytes that Mallory could control.

## Format

We define two signing formats, one attached and one detached.

### Attached

An attached signature is a header packet, followed by any number of non-empty
payload packets, followed by an empty payload packet. The default max size for
each payload is 1MB. An attached signing header packet is a MessagePack array
that looks like this:

```yaml
# attached signing header packet
[
  # format name
  "sillybox",
  # major version
  1,
  # minor version
  0,
  # mode (1 = attached signing)
  1,
  # long-term signing key (NaCl crypto_sign key, 32 bytes)
  b"ababab...",
  # ephemeral signing key (NaCl crypto_sign key, 32 bytes)
  b"cdcdcd...",
  # delegation signature (NaCl crypto_sign, detached, 64 bytes)
  b"2f2f2f...",
]
```

An attached signing payload packet is a MessagePack array that looks like this:

```yaml
# attached signing payload packet
[
  # payload signature (NaCl crypto_sign, detached, 64 bytes)
  b"e3e3e3...",
  # payload bytes
  b"I hereby claim..."
]
```

When signing a message, the sender generates a random ephemeral signing
keypair. The ephemeral public key goes in the header above, and the ephemeral
private key is used to sign payloads.

The delegation signature is made with the sender's long-term signing key. The
signed text is the concatenation of these values:
- SOME_NULL_TERMINATED_CONSTANT_TODO
- b"DELEGATION\0"
- the ephemeral public signing key

Note that this text doesn't contain any bytes that an attacker could control.
This should keep Mallory from tricking Alice into making signatures with her
long-term key that might be meaningful to another application.

Payload signatures are made with the ephemeral signing key. The signed text is
the concatenation of these values:
- SOME_NULL_TERMINATED_CONSTANT_TODO
- b"ATTACHED\0"
- the packet number as an 8-byte big-endian uint, where the first payload
  packet is zero
- the SHA512 of the payload bytes

Some applications might use the Sillybox format, but don't want signature
compatibility with other Sillybox applications. In addition to changing the
format name at the start of the header, these applications should use a
different value for SOME_NULL_TERMINATED_CONSTANT_TODO.

### Detached

A detached signature is one packet, similar to the header of an attached
signature. There are no payload packets, and there's an extra signature in the
header.

```yaml
# detached signing packet
[
  # format name
  "sillybox",
  # major version
  1,
  # minor version
  0,
  # mode (2 = detached signing)
  2,
  # long-term signing key (NaCl crypto_sign key, 32 bytes)
  b"ababab...",
  # ephemeral signing key (NaCl crypto_sign key, 32 bytes)
  b"cdcdcd...",
  # delegation signature (NaCl crypto_sign, detached, 64 bytes)
  b"2f2f2f...",
  # message signature (NaCl crypto_sign, detached, 64 bytes)
  b"9d9d9d...",
]
```

The delegation signature for the ephemeral signing key is the same as in the
attached format. The message signature is made with the ephemeral signing key.
The signed text is the concatenation of these values:
- SOME_NULL_TERMINATED_CONSTANT_TODO
- b"DETACHED\0"
- The SHA512 of the message plaintext.
