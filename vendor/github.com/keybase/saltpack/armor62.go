// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"io"

	"github.com/keybase/saltpack/encoding/basex"
)

// Armor62Params are the armoring parameters we recommend for use with
// a generic armorer.  It specifies the spaces between words, the spacing
// between lines, some simple punctuation, and an encoding alphabet.
var Armor62Params = armorParams{
	BytesPerWord: 15,
	WordsPerLine: 200,
	Punctuation:  byte('.'),
	Encoding:     basex.Base62StdEncoding,
}

// NewArmor62EncoderStream makes a new Armor 62 encoding stream, using the base62-alphabet
// and a 32/43 encoding rate strategy. Pass it an `encoded` stream writer to write the
// encoded stream to.  Also pass an optional "brand" .  It will
// return an io.WriteCloser on success, that you can write raw (unencoded) data to.
// An error will be returned if there is trouble writing the header to encoded.
//
// To make the output look pretty, a space is inserted every 15 characters of output,
// and a newline is inserted every 200 words.
func NewArmor62EncoderStream(encoded io.Writer, typ MessageType, brand string) (io.WriteCloser, error) {
	hdr := makeFrame(headerMarker, typ, brand)
	ftr := makeFrame(footerMarker, typ, brand)
	return newArmorEncoderStream(encoded, hdr, ftr, Armor62Params)
}

// Armor62Seal takes an input plaintext and returns and output armor encoding
// as a string, or an error if a problem was encountered. Also provide a header
// and a footer to frame the message. Uses Base62 encoding scheme
func Armor62Seal(plaintext []byte, typ MessageType, brand string) (string, error) {
	hdr := makeFrame(headerMarker, typ, brand)
	ftr := makeFrame(footerMarker, typ, brand)
	return armorSeal(plaintext, hdr, ftr, Armor62Params)
}

// NewArmor62DecoderStream is used to decode input base62-armoring format. It returns
// a stream you can read from, and also a Frame you can query to see what the open/close
// frame markers were.
func NewArmor62DecoderStream(r io.Reader) (io.Reader, Frame, error) {
	return newArmorDecoderStream(r, Armor62Params)
}

// Armor62Open runs armor stream decoding, but on a string, and it outputs
// a string.
func Armor62Open(msg string) (body []byte, header string, footer string, err error) {
	return armorOpen(msg, Armor62Params)
}

// CheckArmor62Frame checks that the frame matches our standard
// begin/end frame
func CheckArmor62Frame(frame Frame, typ MessageType) (brand string, err error) {
	var hdr, ftr string
	if hdr, err = frame.GetHeader(); err != nil {
		return "", err
	}
	if ftr, err = frame.GetFooter(); err != nil {
		return "", err
	}
	return CheckArmor62(hdr, ftr, typ)
}

// CheckArmor62 checks that the frame matches our standard
// begin/end frame
func CheckArmor62(hdr string, ftr string, typ MessageType) (brand string, err error) {
	brand, err = parseFrame(hdr, typ, headerMarker)
	if err != nil {
		return "", err
	}
	var b2 string
	b2, err = parseFrame(ftr, typ, footerMarker)
	if err != nil {
		return "", err
	}

	if b2 != brand {
		return "", makeErrBadFrame("brand mismatch: %q != %q", brand, b2)
	}
	return brand, nil
}
