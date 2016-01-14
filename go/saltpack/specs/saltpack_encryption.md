# Saltpack Binary Encryption Format

**Changelog**
- 13 Jan 2015
  - Hardcode nonces that are used with ephemeral keys.
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
- Abuse resistance. Bob might use the same encryption key for many applications
  besides saltpack. His saltpack client should never open a box that [wasn't
  intended for
  saltpack](https://sandstorm.io/news/2015-05-01-is-that-ascii-or-protobuf#the-obvious-problem).

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
- The **sender secretbox** is a
  [`crypto_secretbox`](http://nacl.cr.yp.to/secretbox.html) containing the
  sender's long-term public key, encrypted with the **payload key** from below.
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
- The **payload key box** is a [`crypto_box`](http://nacl.cr.yp.to/box.html)
  containing a copy of the **payload key**, encrypted with the recipient's
  public key and the ephemeral private key.

#### Generating a Header Packet

When composing a message, the sender follows these steps to generate the
header:

1. Generate a random 32-byte **payload key**.
2. Generate a random ephemeral keypair, using
   [`crypto_box_keypair`](http://nacl.cr.yp.to/box.html).
3. Encrypt the sender's long-term public key using
   [`crypto_secretbox`](http://nacl.cr.yp.to/secretbox.html) with the **payload
   key** and the nonce `saltpack_sender_secbox\0\0`, to create the **sender
   secretbox**. (`\0` is a null byte.)
4. For each recipient, encrypt the **payload key** using
   [`crypto_box`](http://nacl.cr.yp.to/box.html) with the recipient's public
   key, the ephemeral private key, and the nonce
   `saltpack_payload_key_box`. Pair these with the recipients' public keys,
   or `null` for anonymous recipients, and collect the pairs into the
   **recipients list**.
5. Collect the **format name**, **version**, and **mode** into a list, followed
   by the **ephemeral public key**, the **sender secretbox**, and the nested
   **recipients list**.
6. Serialize the list from #5 into bytes using MessagePack.
7. Count the number of bytes in #6, and serialize that count into a MessagePack
   integer. This is the **header length**.
8. Concatenate the serialized **header length** from #7 with the serialized
   list from #6. This is the header.

    After generating the header, the sender computes two extra values, which
    will be used below to authenticate the payload:

9. Take the [`crypto_hash`](http://nacl.cr.yp.to/hash.html) (SHA512) of the
   bytes from #6. This is the **header hash**.
10. For each recipient, encrypt 32 zero bytes using
    [`crypto_box`](http://nacl.cr.yp.to/box.html) with the recipient's public
    key, the sender's long-term private key, and the first 24 bytes of the hash
    from #9 as a nonce. Take the last 32 bytes of each box. These are the **MAC
    keys**.

Encrypting the sender's long-term public key in step #3 allows Alice to stay
anonymous to Mallory. If Alice wants to be anonymous to Bob as well, she can
reuse the ephemeral key as her sender key. When the ephemeral key and the
sender key are the same, clients may indicate that a message is "intentionally
anonymous" as opposed to "from an unknown sender".

Using the same nonce for each **payload key box** might raise a concern: Are we
violating the rule against nonce reuse, if for example the recipients list
happens to contain the same recipient twice? No, because each of these boxes
holds the same plaintext, reusing a key and a nonce will produce exactly the
same ciphertext twice.

#### Parsing a Header Packet

Recipients parse the header of a message using the following steps:

1. Deserialize the **header length** from the message stream using MessagePack.
2. Read exactly **header length** additional bytes from the message stream.
3. Compute the [`crypto_hash`](http://nacl.cr.yp.to/hash.html) (SHA512) of the
   bytes from #2 to give the **header hash**.
4. Deserialize the bytes from #2 using MessagePack to give the header list.
5. Sanity check the **format name**, **version**, and **mode**.
6. Precompute the ephemeral shared secret using
   [`crypto_box_beforenm`](http://nacl.cr.yp.to/box.html) with the **ephemeral
   public key** and the recipient's private key.
7. Try to open each of the **payload key boxes** in the recipients list using
   [`crypto_box_open_afternm`](http://nacl.cr.yp.to/box.html), the precomputed
   secret from #6, and the nonce `saltpack_payload_key_box`. Successfully
   opening one gives the **payload key**, and the index of the box that worked
   is the **recipient index**.
8. Open the **sender secretbox** using
   [`crypto_secretbox_open`](http://nacl.cr.yp.to/secretbox.html) with the
   **payload key** from #7 and the nonce `saltpack_sender_secbox\0\0`
9. Compute the recipient's **MAC key** by encrypting 32 zero bytes using
   [`crypto_box`](http://nacl.cr.yp.to/box.html) with the recipient's private
   key, the sender's public key from #8, and the first 24 bytes of the hash
   from #3 as a nonce. The **MAC key** is the last 32 bytes of the resulting
   box.

If the recipient's public key is shown in the **recipients list** (that is, if
the recipient is not anonymous), clients may skip all the other **payload key
boxes** in step #7.

When parsing lists in general, if a list is longer than expected, clients
should allow the extra fields and ignore them. That allows us to make future
additions to the format without breaking backward compatibility.

Note that the only time the recipient's private key is used for decryption
(with the **payload key box**), it's used with a hardcoded nonce. So even if
Bob uses the same public key with multiple applications, Bob's saltpack client
will never open a box that [wasn't intended for
saltpack](https://sandstorm.io/news/2015-05-01-is-that-ascii-or-protobuf#the-obvious-problem).

### Payload Packets
A payload packet is a MessagePack list with these contents:

```
[
    authenticators list,
    payload secretbox,
]
```

- The **authenticators list** contains 32-byte HMAC tags, one for each
  recipient, which authenticate the **payload secretbox** together with the
  message header. These are computed with the **MAC keys** derived from the
  header. See below.
- The **payload secretbox** is a NaCl secretbox containing a chunk of the
  plaintext bytes, max size 1 MB. It's encrypted with the **payload key**. The
  nonce is `saltpack_ploadsbNNNNNNNN` where `NNNNNNNN` is the packet numer as
  an 8-byte big-endian unsigned integer. The first payload packet is number 0.

Computing the **MAC keys** is the only step of encrypting a message that
requires the sender's private key. Thus it's the **authenticators list**,
generated from those keys, that proves the sender is authentic.

We compute the authenticators in three steps:

1. Concatenate the **header hash**, the nonce for the **payload secretbox**,
   and the **payload secretbox** itself.
2. Compute the [`crypto_hash`](http://nacl.cr.yp.to/hash.html) (SHA512) of the
   bytes from #1.
3. For each recipient, compute the
   [`crypto_auth`](http://nacl.cr.yp.to/auth.html) (HMAC-SHA512, truncated to
   32 bytes) of the hash from #2, using that recipient's **MAC key**.

The **recipient index** of each authenticator in the list corresponds to the
index of that recipient's **payload key box** in the header. Before opening the
**payload secretbox** in each payload packet, recipients must first verify the
authenticator by repeating steps #1 and #2 and then calling
[`crypto_auth_verify`](http://nacl.cr.yp.to/auth.html).

After encrypting the entire message, the sender adds an extra payload packet
with an empty payload to signify the end. If a message doesn't end with an
empty payload packet, the receiving client should report an error that the
message has been truncated.

The authenticators cover the SHA512 of the payload, rather than the payload
itself, to save time when a large message has many recipients. This assumes the
second preimage resistance of SHA512, in addition to the assumptions that go
into NaCl.

Using [`crypto_secretbox`](http://nacl.cr.yp.to/secretbox.html) to encrypt the
payload takes more time and 16 bytes more space than
[`crypto_stream_xor`](http://nacl.cr.yp.to/stream.html) would. Likewise, using
[`crypto_box`](http://nacl.cr.yp.to/box.html) to compute the MAC keys takes
more time than [`crypto_stream`](http://nacl.cr.yp.to/stream.html) would.
Nonetheless, we prefer box and secretbox for ease of implementation. Many
languages have NaCl libraries that only expose these higher-level
constructions.

## Example

```yaml
# header length
150
# header packet
[
  # format name
  "saltpack",
  # major and minor version
  [1, 0],
  # mode (0 = encryption)
  0,
  # ephemeral public key
  895e690ba0fd8d15f51adf59e161af3f67518fa6e2eaadd8a666b8a1629c2349,
  # sender secretbox
  b49c4c8791cd97f2c244c637df90e343eda4aaa56e37d975d2b7c81d36f44850d77706a51e2ccd57e7f7606565db4b1e,
  # recipient pairs
  [
    # the first recipient pair
    [
      # recipient public key (null in this case, for an anonymous recipient)
      null,
      # payload key box
      c16b6126d155d7a39db20825d6c43f856689d0f8665a8da803270e0106ed91a90ef599961492bd6e49c69b43adc22724,
    ],
    # subsequent recipient pairs...
  ],
]

# payload packet
[
  # authenticators list
  [
    # the first recipient's authenticator
    f90b04186d599b42779564fc93535e1de486de5fbb98e8a987487799910c10c8,
    # subsequent authenticators...
  ],
  # payload secretbox
  f991dbe030e2cfa00a640376f956c68b2d113ec6384441a1834e455acbb046ead9389826e92cb7f91cc7ab30c3d4d38ef5e84d12617f37,
]

# empty payload packet
[
  # authenticators list
  [
    # the first recipient's authenticator
    0bd743eb8b9c48ba1888d265cd90dedcc3d56b0a003ef99763af224c1a6501db,
    # subsequent authenticators...
  ],
  # the empty payload secretbox
  481ef99b4f0d0f918edd82e9f5619a41,
]
```
