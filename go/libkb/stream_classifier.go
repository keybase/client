// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"io"
	"strings"

	"github.com/keybase/go-codec/codec"
	"github.com/keybase/saltpack"
)

// CryptoMessageFormat is one of the known crypto message formats that we admit
type CryptoMessageFormat string

const (
	// CryptoMessageFormatPGP is for PGP
	CryptoMessageFormatPGP CryptoMessageFormat = "pgp"
	// CryptoMessageFormatKeybaseV0 is for the zeroth version of Keybase signatures, which
	// will eventually be deprecated.
	CryptoMessageFormatKeybaseV0 CryptoMessageFormat = "kbv0"
	// CryptoMessageFormatSaltpack is the Saltpack messaging format for encrypted and signed
	// messages
	CryptoMessageFormatSaltpack CryptoMessageFormat = "saltpack"
)

// CryptoMessageType says what type of crypto message it is, regardless of Format
type CryptoMessageType int

const (
	// CryptoMessageTypeEncryption is for an encrypted message
	CryptoMessageTypeEncryption CryptoMessageType = 0
	// CryptoMessageTypeAttachedSignature is for an attached signature
	CryptoMessageTypeAttachedSignature CryptoMessageType = 1
	// CryptoMessageTypeDetachedSignature is for a detached signature
	CryptoMessageTypeDetachedSignature CryptoMessageType = 2
	// CryptoMessageTypeClearSignature is for PGP clearsigning
	CryptoMessageTypeClearSignature CryptoMessageType = 3
	// CryptoMessageTypeAmbiguous is for an ambiguous message based on the stream prefix
	CryptoMessageTypeAmbiguous CryptoMessageType = 4
	// CryptoMessageTypeSignature is for a sig that can be either attached or detached
	CryptoMessageTypeSignature CryptoMessageType = 5
)

// StreamClassification tells what Format the stream is, if it's a Public signature or a Private
// Message, if it's a detached or attached signature in the public case, and if it's
// armored or binary.
type StreamClassification struct {
	Format  CryptoMessageFormat
	Type    CryptoMessageType
	Armored bool
}

func isBase64KeybaseV0Sig(s string) bool {
	firstKey := "body"
	dataBytes := len(firstKey) + 1
	b64dataBytes := (dataBytes + 1) * 4 / 3
	if len(s) < b64dataBytes {
		return false
	}
	buf, err := base64.StdEncoding.DecodeString(s[0:b64dataBytes])
	if err != nil {
		return false
	}
	// Packet should be an encoded dictionary of 3 values
	if buf[0] != 0x83 {
		return false
	}
	var mh codec.MsgpackHandle
	var encoded []byte
	codec.NewEncoderBytes(&encoded, &mh).Encode(firstKey)
	return bytes.HasPrefix(buf[1:], encoded)
}

// Just the fields of the salt pack header that we care about
type saltpackHeaderPrefix struct {
	_struct    bool                 `codec:",toarray"`
	FormatName string               `codec:"format_name"`
	Version    saltpack.Version     `codec:"vers"`
	Type       saltpack.MessageType `codec:"type"`
}

func isSaltpackMessage(stream *bufio.Reader, sc *StreamClassification) bool {
	isArmored, _, messageType, _, err := saltpack.ClassifyStream(stream)
	if err != nil {
		return false
	}

	sc.Armored = isArmored

	switch messageType {
	case saltpack.MessageTypeEncryption, saltpack.MessageTypeSigncryption:
		sc.Type = CryptoMessageTypeEncryption
	case saltpack.MessageTypeAttachedSignature:
		sc.Type = CryptoMessageTypeAttachedSignature
	case saltpack.MessageTypeDetachedSignature:
		sc.Type = CryptoMessageTypeDetachedSignature
	default:
		return false
	}
	sc.Format = CryptoMessageFormatSaltpack
	return true
}

func isPGPBinary(b []byte, sc *StreamClassification) bool {
	if len(b) < 2 {
		return false
	}
	// Top bit is set on PGP packets
	if b[0]&0x80 == 0 {
		return false
	}

	var tag byte
	if (b[0] & 0x40) == 0 {
		// "Old"-style Tag Format
		tag = (b[0] & 0x3f) >> 2
	} else {
		// "New"-style Tag Format
		tag = (b[0] & 0x3f)
	}
	switch tag {
	case 0x1:
		// Encrypted session Key
		sc.Type = CryptoMessageTypeEncryption
	case 0x2:
		// Detached signature
		sc.Type = CryptoMessageTypeDetachedSignature
	case 0x4, 0x8:
		// Either a compressed message or just a one-pass signature type. In either case,
		// it's likely a signature.
		sc.Type = CryptoMessageTypeAttachedSignature
	default:
		return false
	}
	sc.Format = CryptoMessageFormatPGP
	return true
}

func isUTF16Mark(b []byte) bool {
	if len(b) < 2 {
		return false
	}
	return ((b[0] == 0xFE && b[1] == 0xFF) || (b[0] == 0xFF && b[1] == 0xFE))
}

// ClassifyStream takes a stream reader in, and returns a likely classification
// of that stream without consuming any data from it. It returns a reader that you
// should read from instead, in addition to the classification. If classification
// fails, there will be a `UnknownStreamError`, or additional EOF errors if the
// stream ended before classification could go.
func ClassifyStream(r io.Reader) (sc StreamClassification, out io.Reader, err error) {
	// 4096 is currently the default buffer size. It is specified explicitly because go 1.9 does not
	// expose the size of a bufio.Reader (go 1.10 does).
	stream := bufio.NewReaderSize(r, 4096)

	buf, err := stream.Peek(4096)
	if err != nil {
		// If we had a short peek (for example, due to a short stream), we can still continue and ignore the error
		if len(buf) == 0 {
			return sc, stream, err
		}
		err = nil
	}

	sb := string(buf)
	switch {
	case strings.HasPrefix(sb, "-----BEGIN PGP MESSAGE-----"):
		sc.Format = CryptoMessageFormatPGP
		sc.Armored = true
		sc.Type = CryptoMessageTypeAmbiguous
	case strings.HasPrefix(sb, "-----BEGIN PGP SIGNATURE-----"):
		sc.Format = CryptoMessageFormatPGP
		sc.Armored = true
		sc.Type = CryptoMessageTypeDetachedSignature
	case strings.HasPrefix(sb, "-----BEGIN PGP SIGNED MESSAGE-----"):
		sc.Format = CryptoMessageFormatPGP
		sc.Armored = true
		sc.Type = CryptoMessageTypeClearSignature
	case isSaltpackMessage(stream, &sc):
		// Format etc. set by isSaltpackBinary().
	case isBase64KeybaseV0Sig(sb):
		sc.Format = CryptoMessageFormatKeybaseV0
		sc.Armored = true
		sc.Type = CryptoMessageTypeAttachedSignature
	case isPGPBinary(buf, &sc):
		// Format etc. set by isPGPBinary().
	case isUTF16Mark(buf):
		err = UTF16UnsupportedError{}
	default:
		err = UnknownStreamError{}
	}
	return sc, stream, err
}
