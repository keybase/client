# SaltPack Binary Encryption Format

The main building block of our encrypted message format will be NaCl's
[box](http://nacl.cr.yp.to/box.html) and
[secretbox](http://nacl.cr.yp.to/secretbox.html) constructions. These have
several properties that we'll want to keep:
- Privacy. If Alice sends a message to Bob, and Mallory (the man-in-the-middle)
  intercepts the message, Mallory can't read any of its contents.
- Authenticity. When Bob receives a message from Alice, he can verify that
  Alice sent it, and that Mallory didn't change its contents.
- Repudiability. It's possible for Bob to forge a message that appears to be
  from Alice. That means that if Bob reveals Alice's message, Alice can deny
  that she sent it.
- Anonymity. An encrypted message by itself doesn't reveal who wrote it or who
  can read it. (Though we might choose to publish the recipients most of the
  time anyway, to let clients produce friendlier error messages.)

Building on what NaCl boxes give us, there are several other properties we want
our messages to have:
- Multiple recipients, with multiple devices per recipient.
- Streaming. Recipients should be able to to decrypt a message of any size
  without needing to fit the whole thing in RAM.
- Abuse resistance. Alice might use the same encryption key for many
  applications besides SaltPack. If Mallory intercepts some of these other
  ciphertexts, she could [try to trick Alice into decrypting
  them](https://blog.sandstorm.io/news/2015-05-01-is-that-ascii-or-protobuf.html)
  by formatting them as a SaltPack message. Alice's SaltPack client should fail
  to decrypt these forgeries.

## Format

An encrypted message is a series of concatenated MessagePack objects. The first
is a header packet, followed by any number of non-empty payload packets, and
finally an empty payload packet.

### Header Packet
The header packet is a MessagePack list with these contents:

```
[
    format_name,
    version,
    mode,
    ephemeral_public,
    recipients,
]
```

- **format_name** is the string "SaltPack".
- **version** is a list of the major and minor versions, currently `[1, 0]`.
- **mode** is the number 0, for encryption. (1 and 2 are attached and detached
  signing.)
- **ephemeral_public** is an ephemeral NaCl public encryption key, 32 bytes.
  The ephemeral keypair is generated at random by the sender and is only used
  for one message.
- **recipients** is a list of "recipient tuples", one for each recipient
  device.

A recipient tuple is a list of three things:

```
[
    recipient_public,
    sender_box,
    keys_box,
]
```

- **recipient_public** is the recipient's long-term NaCl public encryption key,
  32-bytes. This field may be null, when the recipients are anonymous.
- **sender_box** is a NaCl box containing the sender's long-term NaCl public
  encryption key. It's encrypted with the recipient's public key and the
  ephemeral private key. See also [Nonces](#Nonces) below.
- **keys_box** is a NaCl box containing the recipient's "key set", another
  MessagePack list. It's encrypted with the recipient's public key and the
  sender's long-term private key. Again see [Nonces](#Nonces) below.

The goal of encrypting the **sender_box** with the ephemeral key is that only
recipients of the message should be able to see who the sender is. The goal of
encrypting the **keys_box** with the sender's long-term key is that, by opening
that box with the sender's public key, the recipient can prove the sender is
authentic.

When decrypting, clients should compute the ephemeral shared secret and then
try to open each of the sender boxes. In the NaCl interface, computing the
shared secret is done with the `crypto_box_beforenm` function. (This does a
Curve25519 multiplication and an HSalsa20 key derivation.)

Each recipient's key set, encrypted in the **keys_box** above, is also a list
of three things:

```
[
    mac_group,
    mac_key,
    message_key,
]
```

- **mac_group** specifies which MAC this recipient should check. Each payload
  packet includes a list of MACs, and **mac_group** is an index in that list.
  Different devices belonging to the same person may share a MAC group.
- **mac_key** is a NaCl HMAC key, 32 bytes. Each **mac_key** is generated at
  random by the sender and shared by each recipient device in the corresponding
  **mac_group**.
- **message_key** is a NaCl symmetric encryption key, 32 bytes, which is used
  to encrypt the payload packets. The message key is generated at random by the
  sender and shared by all the recipients.

### Nonces

All NaCl nonces are 24 bytes. Define the pre-nonce `P` to be the first 20 bytes
of the SHA512 of the concatenation of these values:
- `"SaltPack\0"`
- `"nonce\0"`
- the ephemeral public key

Also define `R` to be the index of the recipient in question, in the recipients
list.

The nonce for each sender key box is `P` concatenated with the 32-bit
big-endian unsigned representation of `2*R`.

The nonce for each message keys box is `P` concatenated with the 32-bit
big-endian unsigned representation of `2*R + 1`.

Because the first two nonces are used with one or two long-term keys, we need
to make sure we never reuse them. The `P` prefix makes the probability of nonce
reuse negligible.

We also want to prevent abuse of the decryption key. Alice might use Bob's
public key to encrypt many kinds of messages, besides just SaltPack messages.
If Mallory intercepted one of these, she could assemble a fake SaltPack message
using the intercepted box, in the hope that Bob might reveal something about
its contents by decrypting it. The `P` prefix makes this sort of attack
infeasible, because the only way Mallory can choose `P` is by trying
2<sup>160</sup> ephemeral keys, until one gives the hash she wants. Otherwise
Bob will never decrypt the intercepted boxes, because the nonce he uses won't
match.

Some applications might use the SaltPack format, but don't want decryption
compatibility with other SaltPack applications. In addition to changing the
format name at the start of the header, these applications should use a
[different null-terminated context
string](https://www.ietf.org/mail-archive/web/tls/current/msg14734.html) in
place of `"SaltPack\0"`.

### Payload Packets
A payload packet is a MessagePack list with these contents:

```
[
    payload,
    macs,
]
```

- **payload** is a NaCl secretbox containing a chunk of the plaintext bytes,
  max size 1 MB. It's encrypted with the **message_key**. The nonce is 16 null
  bytes followed by the packet sequence number as an 8-byte big-endian unsigned
  integer, where the first payload packet is zero.
- **macs** is a list of NaCl MACs (HMAC-SHA512, first 32 bytes). The indices in
  this list correspond to the different **mac_group** numbers of the
  recipients.

MACs are computed over the packet sequence number (same as the **payload**
nonce above) concatenated with the first 16 bytes of the **payload** (the
Poly1305 tag). The goal of the MACs is to prevent any of the recipients from
changing the message, since all of the **payload** secretboxes are made with
the **message_key** that all the recipeints share.
