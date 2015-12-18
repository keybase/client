// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	basex "github.com/keybase/client/go/encoding/basex"
	"io"
)

// Armor62Params are the armoring parameters we recommend for use with
// a generic armorer.  It specifies the spaces between words, the spacing
// between lines, some simple punctuation, and an encoding alphabet.
var Armor62Params = ArmorParams{
	BytesPerWord: 15,
	WordsPerLine: 200,
	Punctuation:  byte('.'),
	Encoding:     basex.Base62StdEncoding,
}

// NewArmor62EncoderStream makes a new Armor 62 encoding stream, using the base62-alphabet
// and a 32/43 encoding rate strategy. Pass it an `encoded` stream writer to write the
// encoded stream to.  Also pass a header, and a footer string.  It will
// return an io.WriteCloser on success, that you can write raw (unencoded) data to.
// An error will be returned if there is trouble writing the header to encoded.
//
// To make the output look pretty, a space is inserted every 15 characters of output,
// and a newline is inserted every 200 words.
func NewArmor62EncoderStream(encoded io.Writer, header string, footer string) (io.WriteCloser, error) {
	return NewArmorEncoderStream(encoded, header, footer, Armor62Params)
}

// Armor62Seal takes an input plaintext and returns and output armor encoding
// as a string, or an error if a problem was encountered. Also provide a header
// and a footer to frame the message. Uses Base62 encoding scheme
func Armor62Seal(plaintext []byte, header string, footer string) (string, error) {
	return ArmorSeal(plaintext, header, footer, Armor62Params)
}

// NewArmor62DecoderStream is used to decode input base62-armoring format. It returns
// a stream you can read from, and also a Frame you can query to see what the open/close
// frame markers were.
func NewArmor62DecoderStream(r io.Reader) (io.Reader, Frame, error) {
	return NewArmorDecoderStream(r, Armor62Params)
}

// Armor62Open runs armor stream decoding, but on a string, and it outputs
// a string.
func Armor62Open(msg string) (body []byte, header string, footer string, err error) {
	return ArmorOpen(msg, Armor62Params)
}
