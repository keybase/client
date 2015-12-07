# Encryption

## Properties
NaCl boxes have several properties that we want to keep:
- Privacy and authenticity. Mallory can't read or modify a message.
- Repudiability. Bob can forge a message that appears to be from Alice to Bob.
- Sender and recipient privacy. An encrypted message doesn't reveal who wrote
  it or who can read it.

Building on what NaCl gives us, there are several other properties we want:
- Multiple recipients.
- Streaming. We want to be able to decrypt a message of any size without
  needing to fit the whole thing in RAM.
- Abuse resistance. Alice might use the same encryption key for many
  applications besides Sillybox. Mallory might [try to
  trick](https://blog.sandstorm.io/news/2015-05-01-is-that-ascii-or-protobuf.html)
  Alice into decrypting ciphertexts from other applications, by formatting them
  as part of a Sillybox message. Alice shouldn't be able to decrypt these
  messages at all.

## Format

An encrypted message is an encryption header packet, followed by any number of
non-empty payload packets, followed by an empty payload packet. The default max
size for each payload is 1MB. An encryption header packet is a MessagePack
array that looks like this:

```yaml
# encryption header packet
[
  # format name
  "sillybox",
  # major version
  1,
  # minor version
  0,
  # mode (0 = encryption)
  0,
  # ephemeral sender public key (NaCl crypto_box key, 32 bytes)
  b"ababab...",
  # recipients list
  [
    # set of boxes for a single recipient
    [
      # recipient key (NaCl crypto_box key, 32 bytes, or null)
      b"d3d3d3..."
      # encrypted sender key box (NaCl crypto_box)
      b"a2a2a2..."
      # encrypted message keys box (NaCl crypto_box)
      b"c5c5c5..."
    ],
    # additional recipients...
  ]
]
```

The first field of each recipient set may be null, or it may contain the public
key of that recipient. This removes the anonymity of the recipients, but it
allows applications to show helpful instructions like "To read this message,
use Device Foo." Note that published recipients aren't authenticated, so
applications should only use them as a hint. When there are anonymous
recipients, decryption implementations should compute the `crypto_box_beforenm`
shared secret once using the ephemeral public key, and then attempt to open
each sender key box.

An encryption payload packet is a MessagePack array that looks like this:

```yaml
# encryption payload packet
[
  # list of MACs (NaCl crypto_auth, 32 bytes)
  [
    b"e6e6e6...",
    # additional MACs...
  ],
  # encrypted payload box (NaCl crypto_box)
  b"f8f8f8..."
]
```

When encrypting a message, the sender generates a random ephemeral keypair. The
ephemeral public key goes directly in the header above. The sender key box for
each recipient is encrypted with the ephemeral private key and the recipient's
public key, and it contains contain the sender's long-term public key (NaCl
crypto_box key, 32 bytes). The message keys box for each recipient is encrypted
with the sender's long-term private key and each recipient's public key, and
it contains a MessagePack array with several values:

```yaml
# message keys
[
  # symmetric encryption key (NaCl crypto_secretbox key, 32 bytes)
  b"4a4a4a...",
  # MAC group (a 32-bit big-endian signed int, as 4 bytes, to ensure constant size)
  b"00000000",
  # MAC key (NaCl crypto_auth key, 32 bytes)
  b"2b2b2b...",
]
```

The symmetric encryption key is the same for every recipient, and it opens the
payload box in each payload packet. The MAC group tells the recipient which MAC
to use, as an index into each payload packet's MACs list. The MAC key is the
same for every recipient in the same MAC group. The goal of MAC groups is that
it should be possible to make one MAC for all the recipient devices that belong
to a single person, rather than requiring a separate MAC for every recipient
device, to save space when recipients have many devices.

The MACs are computed over the first 16 bytes of each payload box (the Poly1305
authenticator) concatenated with the packet number. The packet number is a
24-byte big-endian uint, where the first payload packet is zero. This value is
also the nonce for the payload box, see below.

### Nonces

All NaCl nonces are 24 bytes. Define the pre-nonce `P` to be the first 20 bytes
of the SHA512 of the concatenation of these values:
- SOME_NULL_TERMINATED_CONSTANT_TODO
- b"NONCE\0"
- the ephemeral public key

Also define `R` to be the index of the recipient in question, in the recipients
list.

The nonce for each sender key box is `P` concatenated with the 4-byte
big-endian unsigned representation of `2*R`.

The nonce for each message keys box is `P` concatenated with the 4-byte
big-endian unsigned representation of `2*R + 1`.

The nonce for each payload box is the 24-byte big-endian unsigned
representation of the packet number, where the first payload packet is number
0. We don't use `P` here.

Because the first two nonces are used with one or two long-term keys, we need
to make sure we never reuse them. The `P` prefix makes the probability of nonce
reuse negligible.

We also want to prevent abuse of the decryption key. Alice might use Bob's
public key to encrypt many kinds of messages, besides just Sillybox messages.
If Mallory intercepted one of these, she could assemble a fake Sillybox message
that contained the intercepted box, in the hope that Bob might reveal something
about its contents by decrypting it. The `P` prefix makes this attack
difficult, because the only way Mallory can select it is by hashing 2^160
ephemeral keys. Bob will never decrypt the fake message, because the nonce
won't match.

Some applications might use the Sillybox format, but don't want decryption
compatibility with other Sillybox applications. In addition to changing the
format name at the start of the header, these applications should use a
different value for SOME_NULL_TERMINATED_CONSTANT_TODO.
