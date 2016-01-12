# Saltpack
### An Alternative to the PGP Message Format

Keybase today supports both PGP and NaCl keys. NaCl is the more modern of the
two; we rely on its high performance for our file system operations, and it's
also much simpler to program. PGP by contrast is mostly a backwards
compatibility option, for users who have existing keys they want to prove, or
who don't want to use Keybase software directly. Our plan is that most new
users without previous PGP experience will use NaCl keys exclusively.

One issue with that plan is that there isn't a standard encryption/signing
format for NaCl keys, in the style of PGP's ASCII-armored messages, that users
can paste into emails or other websites. We need to invent one.

We start with some simplifying decisions:

- We'll use [NaCl](http://nacl.cr.yp.to/) for all the cryptography.
- We'll use [MessagePack](http://msgpack.org/index.html) for all the binary
  formatting.

Thus, "saltpack". The spec is in three parts:

- [a binary encryption format](saltpack_encryption.md)
- [a binary signing format](saltpack_signing.md)
- [an ASCII armor scheme](saltpack_armor.md)
