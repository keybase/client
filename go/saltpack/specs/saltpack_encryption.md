# Saltpack Binary Encryption Format

**Changelog**
- 11 Jan 2015
  - Authenticate the entire header in every payload packet, and use HMAC for
    authentication instead of the dicey crypto_box hack.
- 5 Jan 2015
  - Move the sender's public key out of the recipient box and into a separate
    secretbox with its own field in the header. That saves us the overhead of
    encrypting it for every recipient.
- 29 Dec 2015
  - We had incorrectly assumed it was hard for other recipients to find a
    Poly1305 collision. Use a hash instead, where we need preimage resistance.
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
  applications besides saltpack. If Mallory intercepts some of these other
  ciphertexts, she could [try to trick Alice into decrypting
  them](https://blog.sandstorm.io/news/2015-05-01-is-that-ascii-or-protobuf.html)
  by formatting them as a saltpack message. Alice's saltpack client should fail
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
each message needs an ephemeral sender public key, used only for this one message,
to hide the sender's true identity. Some implementations of the scheme can
choose to reveal the keys of the receivers to make user-friendlier error
messages on decryption failures (e.g., "Can't decrypt this message on your
phone, but try your laptop.")  If the sender wants to decrypt the message
at a later date, she simply adds her public keys to the list of recipients.

## Implementation

An encrypted message is a series of concatenated MessagePack objects. The first
is a header packet, followed by any number of non-empty payload packets, and
finally an empty payload packet.

### Header Packet
The header packet is a MessagePack integer followed by a MessagePack list:

```
header length

[
    format name,
    version,
    mode,
    ephemeral public key,
    sender secretbox,
    recipients list,
]
```

- The **header length** is the number of bytes in the list that follows.
- The **format name** is the string "saltpack".
- The **version** is a list of the major and minor versions, currently
  `[1, 0]`.
- The **mode** is the number 0, for encryption. (1 and 2 are attached and
  detached signing.)
- The **ephemeral public key** is a NaCl public encryption key, 32 bytes. The
  ephemeral keypair is generated at random by the sender and only used for one
  message.
- The **sender secretbox** is a NaCl secretbox containing the sender's
  long-term public key, encrypted with the **payload key**. (See
  [Nonces](#nonces).)
- The **recipients list** contains a recipient pair for each recipient key,
  including an encrypted copy of the **payload key**. See below.

A recipient pair is a two-element list:

```
[
    recipient public key,
    payload key box,
]
```

- The **recipient public key** is the recipient's long-term NaCl public
  encryption key. This field may be null, when the recipients are anonymous.
- The **payload key box** is a NaCl box containing a copy of the **payload
  key**. It's encrypted with the recipient's public key and the ephemeral
  private key. (See [Nonces](#nonces).)

### Generating a Header Packet

When composing a message, the sender follows these steps to generate the
header:

1. Generate a random 32-byte **payload key**.
2. Generate a random ephemeral keypair, using
   [`crypto_box_keypair`](http://nacl.cr.yp.to/box.html).
3. Encrypt the sender's long-term public key using
   [`crypto_secretbox`](http://nacl.cr.yp.to/secretbox.html) with the **payload
   key**, to create the **sender secretbox**. (See [Nonces](#nonces).)
4. For each recipient, encrypt the **payload key** using
   [`crypto_box`](http://nacl.cr.yp.to/box.html) with the recipient's public
   key and the ephemeral private key. (See [Nonces](#nonces).) Assemble these
   into the **recipients list**.
5. Collect the **format name**, **version**, and **mode** into a list, followed
   by the **ephemeral public key**, the **sender secretbox**, and the nested
   **recipients list**.
6. Serialize the list from #5 into bytes using MessagePack.
7. Count the number of bytes in #6, and serialize that count into a MessagePack
   integer. This is the **header length**.
8. Append the bytes from #6 to the **header length** from #7. This is the
   header.

    After generating the header, the sender computes two extra values, which
    will be used below to authenticate the payload:

9. Take the [`crypto_hash`](http://nacl.cr.yp.to/hash.html) (SHA512) of the
   bytes from #6. This is the **header hash**.
10. For each recipient, encrypt 32 zero bytes using
    [`crypto_box`](http://nacl.cr.yp.to/box.html) with the recipient's public
    key and the sender's long-term private key. (See [Nonces](#nonces).) Take
    the last 32 bytes of each box. These are the **MAC keys**.

Encrypting the sender's long-term public key in step #3 allows Alice to stay
anonymous to Mallory. If Alice wants to be anonymous to Bob as well, she can
reuse the ephemeral key as her sender key. When the ephemeral key and the
sender key are the same, clients may indicate that a message is "intentionally
anonymous" as opposed to "from an unknown sender".

### Parsing a Header Packet

Recipients parse the header of a message using the following steps:

1. Deserialize the **header length** from the message stream using MessagePack.
2. Read exactly **header length** bytes from the message stream.
3. As above, hash the bytes from #2 to give the **header hash**.
4. Deserialize the bytes from #2 using MessagePack to give the header list.
5. Sanity check the **format name**, **version**, and **mode**.
6. Precompute the ephemeral shared secret using
   [`crypto_box_beforenm`](http://nacl.cr.yp.to/box.html) with the **ephemeral
   public key** and the sender's private key.
7. Try to open each of the **payload key boxes** in the recipients list using
   [`crypto_box_afternm`] and the shared secret from #6. (See
   [Nonces](#nonces).) Successfully opening one gives the **payload key**, and
   the index of the box that opened is the **recipient index**.
8. Open the **sender secretbox** using
   [`crypto_secretbox_open`](http://nacl.cr.yp.to/secretbox.html) and the
   **payload key** from #7. (See [Nonces](#nonces).)
9. Compute the recipient's **MAC key** by encrypting 32 zero bytes using
   [`crypto_box`](http://nacl.cr.yp.to/box.html) with the recipient's private
   key and the sender's public key from #8. (See [Nonces](#nonces).) The **MAC
   key** is the last 32 bytes of the resulting box.

Note that when parsing lists in general, if a list is longer than expected,
clients should allow the extra fields and ignore them. That allows us to make
future additions to the format without breaking backward compatibility.

### Payload Packets
A payload packet is a MessagePack list with these contents:

```
[
    authenticators list,
    payload secretbox,
]
```

- The **authenticators list** contains 32-byte HMAC tags, one for each
  recipient, which authenticate the **payload secretbox**.
- The **payload secretbox** is a NaCl secretbox containing a chunk of the
  plaintext bytes, max size 1 MB. It's encrypted with the **payload key**. (See
  [Nonces](#nonces).)

If Mallory doesn't have the **payload key**, she can't modify the **payload
secretbox** without breaking authentication. However, if Mallory is one of the
recipients, then she will have the key, and she could modify the payload. The
**authenticators list** is there to prevent this attack, protecting the
recipients from each other.

We compute the authenticators in three steps:

1. Concatenate the **header hash**, the nonce from the **payload secretbox**,
   and the **payload secretbox** itself.
2. Compute the [`crypto_hash`](http://nacl.cr.yp.to/hash.html) (SHA512) of the
   bytes from #1.
3. For each recipient, compute the
   [`crypto_auth`](http://nacl.cr.yp.to/auth.html) (HMAC-SHA512, truncated to
   32 bytes) of the hash from #2, using that recipient's **MAC key**.

The **recipient index** of each authenticator in the list corresponds to the
index of that recipient's **payload key box** in the header. Before opening the
**payload secretbox** in each payload packet, recipients must first verify the
authenticator by repeating steps #1 and #2 and using
[`crypto_auth_verify`](http://nacl.cr.yp.to/auth.html).

The authenticators cover the SHA512 of the payload, rather than the payload
itself, to save time when a large message has many recipients. This assumes the
second preimage resistance of SHA512, in addition to the assumptions that go
into NaCl.

Using [`crypto_secretbox`](http://nacl.cr.yp.to/secretbox.html) to encrypt the
payload takes more time and 16 bytes more space than
[`crypto_stream_xor`](http://nacl.cr.yp.to/stream.html) would. Likewise, using
[`crypto_box`](http://nacl.cr.yp.to/box.html) to compute the MAC key takes more
time than [`crypto_stream`](http://nacl.cr.yp.to/stream.html) would.
Nonetheless, we prefer box and secretbox for ease of implementation. Many
languages have NaCl libraries that only expose these higher-level
constructions.

### Nonces

We use a pseudorandom prefix to avoid nonce reuse. Define the nonce prefix `P`
to be the first 23 bytes of the SHA512 of the concatenation of these values:
- `"saltpack\0"` (`\0` is a [null
  byte](https://www.ietf.org/mail-archive/web/tls/current/msg14734.html))
- `"encryption nonce prefix\0"`
- the 32-byte **ephemeral public key**

The 24-byte nonce for each public-key box is then concatenation of `P` and an
extra byte. For each **recipient box** the extra byte is 0. For computing each
**MAC key**, the extra byte is 1.

The 24-byte nonce for each secretbox is a counter, 16 zero bytes followed by
the packet number as a 64-bit unsigned big-endian integer. For the **sender
secretbox** in the header, the packet number is 0. For the **payload
secretbox** in each payload packet, the first packet is 1, the second is 2, and
so on.

We might be concerned about reusing the same public-key nonce for each
recipient here. For example, a recipient key could show up more than once in
the recipients list. However, note that in both cases we're boxing the same
message to all recipients. So if the same recipient shows up twice, we'll
produce identical boxes for them the second time.

Besides avoiding nonce reuse and enforcing the packet order, we also want to
prevent abuse of the decryption key. Alice might use Bob's public key to
encrypt many kinds of messages, besides just saltpack messages. If Mallory
intercepted one of these, she could assemble a fake saltpack message using the
intercepted box, in the hope that Bob might reveal something about its contents
by decrypting it. If we used a random nonce transmitted in the message header,
Mallory could choose the nonce to match an intercepted box. Using the `P`
prefix instead makes this attack difficult. Unless Mallory can compute enough
hashes to find one with a specific 23-byte prefix, she can't control the nonce
that Bob uses to decrypt.

Some applications might use the saltpack format, but don't want decryption
compatibility with other saltpack applications. In addition to changing the
format name at the start of the header, these applications should use a
[different null-terminated context
string](https://www.ietf.org/mail-archive/web/tls/current/msg14734.html) in
place of `"saltpack\0"` above.

## Example

```yaml
# header packet
[
  # format name
  "saltpack",
  # major and minor version
  [1, 0],
  # mode (0 = encryption)
  0,
  # ephemeral public key
  e1c7c20fc7ac2012fe4066f5350ae3bbcdb1d243a6ae9706710727611e6efa65,
  # sender secretbox
  86eb1d6032e9a199ecbf844b8d0bb0cde096f84c08a07960f1ea929cee907df5b5e7757ca612a121a7927ffd0cf8fcde,
  # recipient pairs
  [
    # the first recipient pair
    [
      # recipient public key (null in this case, for an anonymous recipient)
      null,
      # payload key box
      36b1d43f73660961bb8033ad880db2b4b5b00b7a08908cb00551de07719a9455f48672eae697ea0270be6ffe1d3740da,
    ],
    # subsequent recipient pairs...
  ],
]

# payload packet
[
  # authenticators list
  [
    # the first recipient's authenticator
    c84eafa03ede35d527b24785ca8b722c84eafa03ede35d527b24785ca8b72266,
    # subsequent authenticators...
  ],
  # payload secretbox
  b3f359cfaa303a6f38378b2525d0f731911dd8d73af53f,
]

# empty payload packet
[
  # authenticators list
  [
    # the first recipient's authenticator
    c556aade21fd10054603560faa6ce53c556aade21fd10054603560faa6ce5355,
    # subsequent authenticators...
  ],
  # the empty payload secretbox
  16585d2741f0be03882d8df76905535a,
]
```
