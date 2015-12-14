# SaltPack Binary Signing Format

As with the encryption format, we want our signing format to have some
properties on top of a plain NaCl signature:
- Streaming. We want to be able to verify a message of any size, without
  fitting the whole thing in RAM, and without requiring a second pass to output
  attached plaintext. But we sould only ever output verified data.
- Abuse resistance. Alice might use the same signing key for many applications
  besides SaltPack. Mallory (an attacker) could [try to trick Alice into signing
  messages](https://blog.sandstorm.io/news/2015-05-01-is-that-ascii-or-protobuf.html)
  that are meaningful to other applications. Alice should avoid signing bytes
  that Mallory could have chosen.

We define two signing formats: one attached and one detached. The attached
format will have a header packet and payload packets similar to the [encryption
format](saltpack_encryption.md), with an empty packet at the end of the
message. The detached format will contain just a header packet, with no
payload.

Both formats will hash a random nonce along with the plaintext, and then sign
the resulting hash. The goal for this nonce is to guarantee that we always sign
bytes that are unpredictable to an attacker. Without the nonce, an attacker
giving us plaintexts to sign might be able to find one whose hash had some
desirable substring, which could be meaningful to another application.

## Attached Format

An attached signature is a header packet, followed by any number of non-empty
payload packets, followed by an empty payload packet. An attached signing
header packet is a MessagePack array that looks like this:

```
[
    format_name,
    version,
    mode,
    sender_public,
    nonce,
]
```

- **format_name** is the string "SaltPack".
- **version** is a list of the major and minor versions, currently `[1, 0]`.
- **mode** is the number 1, for attached signing. (0 is encryption, and 2 is
  detached signing.)
- **sender_public** is the sender's long-term NaCl signing public key, 32 bytes.
- **nonce** is 16 random bytes.

Payload packets are MessagePack arrays that looks like this:

```
[
    payload_chunk,
    signature,
]
```

- **payload_chunk** is a chunk of the plaintext bytes, max size 1 MB.
- **signature** is a detached NaCl signature, 64 bytes.

To make each signature, the sender first takes the SHA512 hash of the
concatenation of three values:
- the **nonce** from above
- the packet sequence number, as an 8-byte big-endian unsigned integer, where
  the first payload packet is zero
- the **payload_chunk**

What the sender signs is the concatenation of three other values:
- `"SaltPack\0"`
- `"attached\0"`
- the SHA512 hash above

Some applications might use the SaltPack format, but don't want signature
compatibility with other SaltPack applications. In addition to changing the
format name at the start of the header, these applications should use a
[different null-terminated context
string](https://www.ietf.org/mail-archive/web/tls/current/msg14734.html) in
place of `"SaltPack\0"`.

## Detached Format

A detached signature is similar to an attached signature header packet by
itself, with an extra signature field at the end.

```
[
    format_name,
    version,
    mode,
    sender_public,
    nonce,
    signature,
]
```

- **format_name** is the string "SaltPack".
- **version** is a list of the major and minor versions, currently `[1, 0]`.
- **mode** is the number 2, for attached signing. (0 is encryption, and 1 is
  attached signing.)
- **sender_public** is the sender's long-term NaCl signing public key, 32 bytes.
- **nonce** is 16 random bytes.
- **signature** a detached NaCl signature, 64 bytes

To make the signature, the sender first takes the SHA512 hash of the
concatenation of two values:
- the **nonce** from above
- the entire plaintext

What the sender signs is the concatenation of three other values:
- `"SaltPack\0"`
- `"detached\0"`
- the SHA512 hash above
