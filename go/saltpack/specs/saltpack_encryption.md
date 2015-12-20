# SaltPack Binary Encryption Format

**Changelog**
- 16 Dec 2015
  - Unify the sender box and the key box into a single "recipient box".
- 15 Dec 2015
  - Initial version.

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
- Multiple recipients.
- Streaming. Recipients should be able to to decrypt a message of any size
  without needing to fit the whole thing in RAM. At the same time, decryption
  should never output any unauthenticated bytes.
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
- **recipients** is a list of pairs, one for each recipient key.

A recipient pair is a two-element list:

```
[
    recipient_public,
    recipient_box,
]
```

- **recipient_public** is the recipient's long-term NaCl public encryption key.
  This field may be null, when the recipients are anonymous.
- **recipient_box** is a NaCl box encrypted with the recipient's public key and
  the ephemeral private key.

The the **recipient_box** contains another two-element MessagePack list:

```
[
    sender_public,
    message_key,
]
```

- **sender_public** is the sender's long-term NaCl public encryption key.
- **message_key** is a NaCl symmetric key used to encrypt the payload packets.
  The message key is generated at random by the sender and only used for one
  message.

Putting the sender's key in the **recipient_box** allows Alice to stay
anonymous to Mallory. If Alice wants to be anonymous to Bob as well, she can
reuse the ephemeral key as her long term key. When the ephemeral key and the
sender key are the same, clients may indicate that a message is "intentionally
anonymous" as opposed to "from an unknown sender".

When decrypting, clients should compute the ephemeral shared secret and then
try to open each of the sender boxes. In the NaCl interface, computing the
shared secret is done with the
[`crypto_box_beforenm`](http://nacl.cr.yp.to/box.html) function. (This does a
Curve25519 multiplication and an HSalsa20 key derivation.)

### Payload Packets
A payload packet is a MessagePack list with these contents:

```
[
    tag_boxes,
    payload_secretbox,
]
```

- **tag_boxes** is a list of NaCl boxes, one for each recipient. They contain
  the 16-byte authenticator for the following **payload_secretbox**. They're
  encrypted with the recipient's public key and the sender's long-term private
  key. See [Nonces](#nonces) below.
- **payload_secretbox** is a NaCl secretbox containing a chunk of the plaintext
  bytes, max size 1 MB. It's encrypted with the symmetric message key. The
  first 16 bytes (the Poly1305 authenticator) are stripped off. Again see
  [Nonces](#nonces) below.

The purpose of the **tag_boxes** is to prevent recipients from reusing the
header packet and the symmetric message key to forge new messages that appear
to be from the same sender to other recipients. (Recipients can forge messages
that appear to be sent to them only, not messages that appear to be sent to
anyone else.) To open a **payload_secretbox**, recipients must first open their
corresponding tag box, which proves that the packet was written by the original
sender, before prepending the tag to secretbox and opening that. Stripping the
tag from the secretbox is a safety measure, to prevent implementations from
skipping this verification step.

### Nonces

The sender boxes, key boxes, and tag boxes are all encrypted with long-term
keys, so it's important that they never reuse nonces. We use a pseudorandom
prefix to avoid this. Define the nonce prefix `P` to be the first 16 bytes of
the SHA512 of the concatenation of these values:
- `"SaltPack\0"` (`\0` is a [null
  byte](https://www.ietf.org/mail-archive/web/tls/current/msg14734.html))
- `"encryption nonce prefix\0"`
- the 32-byte **ephemeral_public** key

The nonce for each box is the concatenation of `P` and a 64-bit big-endian
unsigned counter. For each **sender_box** the counter is 0. For each
**key_box** the counter is 1. For each payload packet we then increment the
counter, so the first set of **tag_boxes** is 2, the next is 3, and so on. For
each **payload_secretbox**, the nonce is the same as for the associated
**tag_boxes**. The strict ordering of nonces should make it impossible to drop
or reorder any payload packets.

We might be concerned about reusing the same nonce for each recipient here. For
example, a recipient key could show up more than once in the recipients list.
However, note that all the sender boxes encrypt the same sender, all the key
boxes encrypt the same key, and all the tag boxes in a given payload packet
encrypt the same tag. So if the same recipient shows up twice, we'll produce
exactly the same boxes for them the second time.

Besides avoiding nonce reuse, we also want to prevent abuse of the decryption
key. Alice might use Bob's public key to encrypt many kinds of messages,
besides just SaltPack messages. If Mallory intercepted one of these, she could
assemble a fake SaltPack message using the intercepted box, in the hope that
Bob might reveal something about its contents by decrypting it. If we used a
random nonce transmitted in the message header, Mallory could pick the nonce to
fit the intercepted box. Using the `P` prefix instead makes this attack
difficult. Unless Mallory can compute enough hashes to find one with a specific
16-byte prefix, she can't control the nonce that Bob uses to decrypt.

Some applications might use the SaltPack format, but don't want decryption
compatibility with other SaltPack applications. In addition to changing the
format name at the start of the header, these applications should use a
[different null-terminated context
string](https://www.ietf.org/mail-archive/web/tls/current/msg14734.html) in
place of `"SaltPack\0"`.

## Example

```yaml
# header packet
[
  # format name
  "SaltPack",
  # major and minor version
  [1, 0],
  # mode (0 = encryption)
  0,
  # ephemeral public key
  LfqrHp8MXAjgaRgwDVc354+xT+KbCZaAgXXRL7bLWwI=,
  # recipient tuples
  [
    # the first recipient
    [
      # recipient public key (null in this case, for an anonymous recipient)
      null,
      # recipient box
      yYTf3JDEYYxfKsHpF0yd5V4Ud7CAxFSJQCj5fV3x6WDGvxsmg/QQW6Qe3muB7uyg5PdlxEOg7fsmEXcFBEBDM9IzmvWsFZnqHk7yaLnkLd9mHeJLtw==,
    ],
    # subsequent recipients...
  ],
]

# payload packet
[
  # tag boxes
  [
    # the first recipient's tag box
    60e3MFjj9yd4IF23eLXaWk5Vfk3+YkjQdDU/zNu3M7A=,
    # subsequent tag boxes...
  ],
  # payload secretbox, with the tag stripped
  kEzDRKm2P6hB/U7+cnPco2AI+CiCI6+VDEZx1JVoPLtKY3pN2Ncr,
]

# empty payload packet
[
  # tag boxes
  [
    # the first recipient's tag box
    MD8+n5xxYKbt/z0DlmjQHRvt9k0TYjpJXDzr+azv1cc=,
    # subsequent tag boxes...
  ],
  # the empty stripped payload secretbox (a zero-length byte string)
  "",
]
```
