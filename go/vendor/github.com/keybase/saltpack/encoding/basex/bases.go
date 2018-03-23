// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package basex

// skipChars are the chars that we allow in the body but can be skipped
// in the below encodings. Note that if a character is listed both in the
// skipChar last and in the alphabet list, it isn't skipped. See the specifics
// of NewEncoding() for more details.
//
// Note that this skip char list is in ASCII order
const b58skipChars = "\t\n\r !\"#$%&'()*+,-./0:;<=>?@IOl[\\]^_`{|}~"

// Bitcoin-style encoding
const base58EncodeStd = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

// Base58StdEncodingStrict is the standard base58-encoding, with Strict mode enforcing
// no foreign characters
var Base58StdEncodingStrict = NewEncoding(base58EncodeStd, 19, "")

// Base58StdEncoding is the standard base58-encoding. Foreign characters are ignored
// as long as they're from the blessed set.
var Base58StdEncoding = NewEncoding(base58EncodeStd, 19, b58skipChars)

// Unlike Base64, we put the digits first.
const base62EncodeStd = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

// Base62StdEncodingStrict is the standard 62-encoding, with a 32-byte input block and, a
// 43-byte output block. Strict mode is on, so no foreign characters.
var Base62StdEncodingStrict = NewEncoding(base62EncodeStd, 32, "")

// Base62StdEncoding is the standard 62-encoding, with a 32-byte input block and, a
// 43-byte output block. Foreign chracters are ignored
var Base62StdEncoding = NewEncoding(base62EncodeStd, 32, "\t\n\r >")
