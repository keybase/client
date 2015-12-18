# SaltPack Binary Signing Format

As with the [encryption format](saltpack_encryption.md), we want our signing
format to have some properties on top of a standard NaCl signature:
- Streaming. We want to be able to verify a message of any size, without
  fitting the whole thing in RAM, and without requiring a second pass to output
  attached plaintext. But we should only ever output verified data.
- Abuse resistance. Alice might use the same signing key for many applications
  besides SaltPack. Mallory (an attacker) could [try to trick Alice into
  signing
  messages](https://blog.sandstorm.io/news/2015-05-01-is-that-ascii-or-protobuf.html)
  that are meaningful to other applications. Alice should avoid signing bytes
  that Mallory could have chosen.

## Design

We define two signing formats: one attached and one detached. The attached
format will have a header packet and payload packets similar to the [encryption
format](saltpack_encryption.md), with an empty packet at the end of the
message, and an incrementing counter to prevent reordering. The detached format
will contain just a header packet, with no payload.

Both formats will hash a random nonce along with the plaintext, and then sign
the resulting hash. The goal for this nonce is to guarantee that we always sign
bytes that are unpredictable to an attacker. Without the nonce, an attacker
giving us plaintexts to sign might be able to find one whose hash had some
desirable substring, which could be meaningful to another application.

## Attached Implementation

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
    signature,
    payload_chunk,
]
```

- **signature** is a detached NaCl signature, 64 bytes.
- **payload_chunk** is a chunk of the plaintext bytes, max size 1 MB.

To make each signature, the sender first takes the SHA512 hash of the
concatenation of three values:
- the **nonce** from above
- the packet sequence number, as a 64-bit big-endian unsigned integer, where
  the first payload packet is zero
- the **payload_chunk**

The sender then signs the concatenation of three values:
- `"SaltPack\0"`
- `"attached signature\0"`
- the SHA512 hash above

Some applications might use the SaltPack format, but don't want signature
compatibility with other SaltPack applications. In addition to changing the
format name at the start of the header, these applications should use a
[different null-terminated context
string](https://www.ietf.org/mail-archive/web/tls/current/msg14734.html) in
place of `"SaltPack\0"`.

## Detached Implementation

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
- **sender_public** is the sender's long-term NaCl public signing key, 32
  bytes.
- **nonce** is 16 random bytes.
- **signature** a detached NaCl signature, 64 bytes

To make the signature, the sender first takes the SHA512 hash of the
concatenation of two values:
- the **nonce** from above
- the entire plaintext

The sender then signs the concatenation of three values:
- `"SaltPack\0"`
- `"detached signature\0"`
- the SHA512 hash above

## Examples

An attached signature:

```yaml
# header packet
[
  # format name
  "SaltBox",
  # major and minor version
  [1, 0],
  # mode (1 = attached signing)
  1,
  # sender public key
  +Wv5iclX59CYwIApHt/FLEu/olkyXvDa55kEZlNHP80=,
  # nonce
  2664Qy9MgsPnX1SsVAcUxw==,
]

# payload packet
[
  # signature
  lD+n7GkGjQb1lFnmjZj0TOQAoVQsJdYXiRbvXdtStit8iVco2b4hWPvSiEelGxQIAD9JoeJS6Objw7qD3+o8AQ==,
  # payload chunk
  "The Magic Words are Squeamish Ossifrage",
]

# empty payload packet
[
  # signature
  0tdb3ItnxTRYzDgn/AUg/2+uHYvAPd+y9PtSnx4ToDMTLorWxQM4ZTQb849s7buQT4CIQL9w6TXxoPARXSzYCQ==,
  # empty payload chunk (a zero-length byte string)
  "",
]
```

A detached signature:

```yaml
# header packet (the only packet)
[
  # format name
  "SaltBox",
  # major and minor version
  [1, 0],
  # mode (2 = detached signing)
  2,
  # sender public key
  kbjTB6b/p7TkXe41O9FlvcyppPmdPiBhTt95HhioWls=,
  # nonce
  58uObqp8j9IxRflCOI0tbw==,
  # signature
  hid+jLqgC1O7CBRDjpsmC/M20b5Fam15KhktLquKu2Gy+KZcKv74qGr7x9wytK0LX87lBoC829qXXJI1JCb6Dg==,
]
```
