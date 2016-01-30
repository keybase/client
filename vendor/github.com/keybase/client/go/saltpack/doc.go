/*

Package saltpack is an implementation of the saltpack message format. Saltpack
is a light wrapper around Dan Berstein's famous NaCl library. It adds support
for longer messages, streaming input and output of data, multiple recipients
for encrypted messages, and a reasonable armoring format. We intend Saltpack
as a replacement for the PGP messaging format, as it can be used in many of
the same circumstances.  However, it is designed to be: (1) simpler; (2)
easier to implement; (3) judicious (perhaps judgmental) in its crypto usage;
(4) fully modern (no CFB mode here); (5) high performance; (6) less bug-
prone; (7) generally unwilling to output unauthenticated data; and (8) easier
to compose with other software in any manner of languages or platforms.

Key Management

Saltpack makes no attempt to manage keys. We assume the wrapping application
has a story for key management.

Modes of Operation

Saltpack supports three modes of operation: encrypted messages, attached
signatures, and detached signatures. Encrypted messages use NaCl's
authenticated public-key encryption; we add repudiable authentication. An
attached signature contains a message and a signature that authenticates it. A
detached signature contains just the signature, and assumes an independent
delievery mechanism for the file (this might come up when distributing an ISO
and separate signature of the file).

Encoding

Saltpack has two encoding modes: binary and armored. In armored mode, saltpack
outputs in Base62-encoding, suitable for publication into any manner of Web
settings without fear of markup-caused mangling.

API

This saltpack library implementation supports two API patterns: streaming and
all-at-once. The former is useful for large files that can't fit into memory;
the latter is more convenient. Both produce the same output.

More Info

See https://saltpack.org

*/
package saltpack
