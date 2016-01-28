# Saltpack Binary Signing Format

**Changelog**
- 18 Jan 2015
  - Double-encode the header, and hash the entire thing into signatures.

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
- the **header hash** from above
- the packet sequence number, as a 64-bit big-endian unsigned integer, where
  the first payload packet is zero
- the **payload chunk**

The sender then signs the concatenation of two values:
- `"saltpack attached signature\0"`
- the SHA512 hash above

As in the [encryption spec](saltpack_encryption.md), after encrypting the
entire message, the sender adds an extra payload packet with an empty payload
to signify the end. If a message doesn't end with an empty payload packet, the
receiving client should report an error that the message has been truncated.

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

The sender then signs the concatenation of two values:
- `"saltpack detached signature\0"`
- the SHA512 hash above

## Examples

An attached signature:

```yaml
# header packet (on the wire, this is double-encoded)
[
  # format name
  "saltpack",
  # major and minor version
  [1, 0],
  # mode (1 = attached signing)
  1,
  # sender public key
  033e2d505c9ec79fb16fb40f34d743d5805dd36c844741420671fb57df24ed93,
  # nonce
  22737333c279555e6e33a79b1ba06cab47d7689d65b43615393d6d607f1d7a52,
]

# payload packet
[
  # signature
  bba4e5dff8cc6cea88e1d505d1f9a716ca0e79a142e26896493daf82733b4e220c555a0941e52673c25a384f334e0ccdcb62f89a4f01d13f0cb53961f0f4cc00,
  # payload chunk
  "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.",
]

# empty payload packet
[
  # signature
  3a83ebf3fcc2dd30b8c148cd0097ecc93d265e24e83798d28a1370ef54fc8933a9aa56b7118d147cda2ab2c83b378b1b2104e5c6f2320313fc54d173584b0706,
  # empty payload chunk (a zero-length byte string)
  "",
]
```

A detached signature:

```yaml
# header packet (on the wire, this is double-encoded)
[
  # format name
  "saltpack",
  # major and minor version
  [1, 0],
  # mode (2 = detached signing)
  2,
  # sender public key
  8a732edded5a23036c4c8caca6a04321f007b2e8b60cab975950a17b4c02ca76,
  # nonce
  38d01af91e8cd9e6a79f19ea55733fea9778be327170d4fd8ed2074d4be0b784,
]

# signature
6628f12374ce7c2a55d1c864e71206296e380586c9e61c3aa3ac1b5f11674bd53b895705183ff54d00fdeb5534b412569f58cb22dc6b3673b9a265e3bffe470d
```
