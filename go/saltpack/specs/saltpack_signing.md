# Saltpack Binary Signing Format

As with the [encryption format](saltpack_encryption.md), we want our signing
format to have some properties on top of a standard NaCl signature:
- Streaming. We want to be able to verify a message of any size, without
  fitting the whole thing in RAM, and without requiring a second pass to output
  attached plaintext. But we should only ever output verified data.
- Abuse resistance. Alice might use the same signing key for many applications
  besides saltpack. Mallory (an attacker) could [try to trick Alice into
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
the resulting hash. This nonce serves two purposes. First, in the attached
format, it prevents an attacker from swapping in payload packets from other
messages. Second, in both formats, it helps us avoid signing bytes that an
attacker could predict in advance.

## Attached Implementation

An attached signature is a header packet, followed by any number of non-empty
payload packets, followed by an empty payload packet. An attached signing
header packet is a MessagePack array that looks like this:

```
[
    format name,
    version,
    mode,
    sender public key,
    nonce,
]
```

- **format name** is the string "saltpack".
- **version** is a list of the major and minor versions, currently `[1, 0]`.
- **mode** is the number 1, for attached signing. (0 is encryption, and 2 is
  detached signing.)
- **sender public key** is the sender's long-term NaCl signing public key, 32 bytes.
- **nonce** is 32 random bytes.

As in the [encryption spec](saltpack_encryption.md), the header packet is
serialized into a MessagePack `array` object, hashed with SHA512 to produce the
**header hash**, and then serialized *again* into a MessagePack `bin` object.

Payload packets are MessagePack arrays that looks like this:

```
[
    signature,
    payload chunk,
]
```

- **signature** is a detached NaCl signature, 64 bytes.
- **payload chunk** is a chunk of the plaintext bytes, max size 1 MB.

To make each signature, the sender first takes the SHA512 hash of the
concatenation of three values:
- the **payload hash** from above
- the packet sequence number, as a 64-bit big-endian unsigned integer, where
  the first payload packet is zero
- the **payload chunk**

The sender then signs the concatenation of three values:
- `"saltpack\0"`
- `"attached signature\0"`
- the SHA512 hash above

As in the [encryption spec](saltpack_encryption.md), after encrypting the
entire message, the sender adds an extra payload packet with an empty payload
to signify the end. If a message doesn't end with an empty payload packet, the
receiving client should report an error that the message has been truncated.

Some applications might use the saltpack format, but don't want signature
compatibility with other saltpack applications. In addition to changing the
format name at the start of the header, these applications should use a
[different null-terminated context
string](https://www.ietf.org/mail-archive/web/tls/current/msg14734.html) in
place of `"saltpack\0"`.

## Detached Implementation

A detached signature header packet is equivalent to an attached signature
header packet with a different mode (2 instead of 1). As above it's
twice-encoded, with the **header hash** computed after the first encoding. A
detached header is followed by a single MessagePack `bin` object, containing
the 64-byte detached NaCl signature.

```
[
    format name,
    version,
    mode,
    sender public key,
    nonce,
]

signature
```

To make the signature, the sender first takes the SHA512 hash of the
concatenation of two values::
- the **header hash** from above
- the entire plaintext

The sender then signs the concatenation of three values:
- `"saltpack\0"`
- `"detached signature\0"`
- the SHA512 hash above

## Examples

An attached signature:

```yaml
# header packet
[
  # format name
  "saltpack",
  # major and minor version
  [1, 0],
  # mode (1 = attached signing)
  1,
  # sender public key
  1f5025dfb138aebee8517fe988d7d73679a55f7da349cb2283bd196907120f7d,
  # nonce
  b5504c63ff77de96ef74a28f9397ff80,
]

# payload packet
[
  # signature
  2eec257a9c34053f16d4ac6438b5a338670b88e5b1d71c2e51e675d0caf2abb962224b5baaf3ce125a199c7cee75de8cf442c97f74540830e121105094ca580a,
  # payload chunk
  "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.",
]

# empty payload packet
[
  # signature
  988be76509f02bd882c8fe47829d5813a35ea3a06ca776df8ff7eb85d7cbc3fb52785d40ec42f674cb62429fc52a7f84c1400e3c26e0e3b8b7fd2daf7f915d08,
  # empty payload chunk (a zero-length byte string)
  "",
]
```

A detached signature:

```yaml
# header packet (the only packet)
[
  # format name
  "saltpack",
  # major and minor version
  [1, 0],
  # mode (2 = detached signing)
  2,
  # sender public key
  14cda529c0bc06d5122d41b862295e5694ecdc9241a4b00a988852c40e08ed9f,
  # nonce
  7ac1e7bcec1ee1f45960af752dba8772,
  # signature
  eb190b6f77ceb5af1106ac66e47380a01f811cd0c9988aec15d1fbc399f2606146b76104103f7a0f94e267370829cf935d04e8eda60483f4e1bca32f88936c02,
]
```
