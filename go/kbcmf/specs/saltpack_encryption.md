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

## Design

At a high-level, the message is encrypted once using a symmetric key shared
across all recipients. It is then MAC'ed for each recipient individually, to
preserve the intent of the original sender, and to prevent recipients from
maliciously altering the message. For example, if Alice is sending to Bob and
Charlie, Bob should not be able to rewrite the message and pass it to Charlie
without Charlie detecting the attack.

The message is chunked into 1MB chunks. A sequential nonce used for the
encryption and MAC's ensures that the 1MB chunks cannot be reordered. The end
of the message is marked with an empty chunk — encrypted and MAC'ed the same
way — to prevent truncation attacks.

Though the scheme is designed with the intent of having multiple per-device
keys for each recipient, the implementation treats all recipient keys
equivalently.  That is, sending a message to five recipients with four
keys each is handled the same as sending to one recipient with twenty keys,
or twenty recipients with one key each.

Finally, the scheme accommodates anonymous receivers and anonymous senders. Thus,
each message needs an emphemeral sender public key, used only for this one message,
to hide the sender's true identity. Some implementations of the scheme can
choose to reveal the keys of the receivers to make user-friendlier errors
messages on decryption failures (e.g., "Can't decrypt this message on your
phone, but try your laptop.")  If the sender wants to decrypt the message
at a later date, she simply adds her public keys to the list of recipients.

## Implementation

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
  The ephemeral keypair is generated at random by the sender and only used for
  one message.
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
  ephemeral private key. See also [Nonces](#nonces) below.
- **keys_box** is a NaCl box containing the recipient's "key set", another
  MessagePack list. It's encrypted with the recipient's public key and the
  sender's long-term private key. Again see [Nonces](#nonces) below.

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

- **mac_group** tells the recipient which MAC is intended for them in each of
  the payload packets. Example below. Different devices belonging to the same
  person may share a MAC group. To make this number constant size, we set the
  2<sup>31</sup> bit before serializing it and unset that bit after
  deserializing it.
- **mac_key** is a NaCl HMAC key, 32 bytes. Each **mac_key** is generated at
  random by the sender and shared by each recipient device in the corresponding
  **mac_group**.
- **message_key** is a NaCl symmetric encryption key, 32 bytes, which is used
  to encrypt the payload packets. The message key is generated at random by the
  sender and shared by all the recipients.

For example, Bob opens his **keys_box** and sees the value of **mac_group** is
`0x80000001`. He unsets the 2<sup>31</sup> bit and determines that his unmasked
group is 1. Then as Bob decrypts each payload packet, he verifies the MAC at
index 1 in the payload packet's list of MACs. See [Payload
Packets](#payload-packets) for how those MACs are computed.

### Random Nonces

All NaCl nonces are 24 bytes. Define the pre-nonce `P` to be the first 20 bytes
of the SHA512 of the concatenation of these values:
- `"SaltPack\0"` (`\0` is a [null
  byte](https://www.ietf.org/mail-archive/web/tls/current/msg14734.html))
- `"nonce\0"`
- the ephemeral public key

Also define `R` to be the index of the recipient tuple in question, in the
recipients list.

The nonce for each **sender_box** is `P` concatenated with the 32-bit
big-endian unsigned representation of `2*R`.

The nonce for each **keys_box** is `P` concatenated with the 32-bit big-endian
unsigned representation of `2*R + 1`.

These nonces are used with long-term keys, so we need to make sure we never
reuse them. Because the ephemeral keypair is generated at random for each
message, nonce reuse should be very unlikely.

We also want to prevent abuse of the decryption key. Alice might use Bob's
public key to encrypt many kinds of messages, besides just SaltPack messages.
If Mallory intercepted one of these, she could assemble a fake SaltPack message
using the intercepted box, in the hope that Bob might reveal something about
its contents by decrypting it. The `P` prefix makes this sort of attack
difficult. Unless Mallory can compute enough hashes to choose a 20-byte prefix,
she can't control the nonce that Bob uses to decrypt.

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
    payload_secretbox,
    macs,
]
```

- **payload_secretbox** is a NaCl secretbox containing a chunk of the plaintext
  bytes, max size 1 MB. It's encrypted with the **message_key**.
- **macs** is a list of NaCl MACs (HMAC-SHA512, first 32 bytes). The indices in
  this list correspond to the different **mac_group** numbers of the
  recipients.

The nonce for each **payload_secretbox** is 16 null bytes followed by a 64-bit
unsigned big-endian sequence number, where the first payload packet is sequence
number 0. These nonces don't need to be random, because the **message_key** is
unique for each message.

MACs are computed over the packet sequence number (same as the in the nonce
above) concatenated with the first 16 bytes of **payload_secretbox** (the
Poly1305 tag). The goal of the MACs is to prevent any of the recipients from
changing the message, since all of the payload secretboxes are made with the
**message_key** that all the recipeints share.
