// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"encoding/base64"
	"errors"
	"io"
	"regexp"
	"strings"

	"github.com/keybase/go-codec/codec"
	"github.com/keybase/saltpack"
)

// StreamPeeker is a reader that takes another reader and allow you to
// peek at the beginning of the stream without consuming it.
type StreamPeeker struct {
	r       io.Reader
	buf     []byte
	didRead bool
}

var _ io.Reader = (*StreamPeeker)(nil)

// NewStreamPeeker makes a new Reader from the given Reader, but also
// allows you to Peek at the first N bytes.
func NewStreamPeeker(r io.Reader) *StreamPeeker {
	return &StreamPeeker{r: r}
}

// Read is the standard read, that either reads the buffered peek region
// or reads directly from the stream.
func (p *StreamPeeker) Read(buf []byte) (n int, err error) {
	p.didRead = true
	if len(p.buf) > 0 {
		n = copy(buf, p.buf)
		p.buf = p.buf[n:]
		return n, nil
	}
	return p.r.Read(buf)
}

// ErrCannotPeek is returned if you try to Peek, then Read, then Peek from
// a stream, which isn't allowed. You can only Peek, peek, peek, read, read, read, &c.
var ErrCannotPeek = errors.New("Cannot peek after read")

// Peek at the first N bytes of the stream.
func (p *StreamPeeker) Peek(buf []byte) (n int, err error) {
	if p.didRead {
		return 0, ErrCannotPeek
	}
	n, err = io.ReadFull(p.r, buf)
	p.buf = append(p.buf, buf[:n]...)
	return n, err
}

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

func isSaltpackBinary(b []byte, sc *StreamClassification) bool {
	if len(b) < 6 {
		return false
	}

	// The encryption header is double-encoded. (And signing will be in the
	// future.) For these headers we need to skip the "bin" tag at the front to
	// get at the encoded header array.
	var binTagBytesToSkip int
	if b[0] == 0xc4 {
		binTagBytesToSkip = 2
	} else if b[0] == 0xc5 {
		binTagBytesToSkip = 3
	} else if b[0] == 0xc6 {
		binTagBytesToSkip = 5
	} else {
		return false
	}

	// Verify the type of the array and its minimum length, and copy the array
	// bytes to a scratch buffer.
	arrayTagByte := b[binTagBytesToSkip]
	if arrayTagByte <= 0x93 || arrayTagByte >= 0x9f {
		// TODO: We should allow arrays of more than 15 elements here.
		return false
	}
	tmp := make([]byte, len(b))
	copy(tmp, b[binTagBytesToSkip:])

	// Hack -- make this a 3-value Msgpack Array, since we only care about the
	// first 3 fields, and don't want to bother slurping in more than that.
	tmp[0] = 0x93
	var mh codec.MsgpackHandle
	var sphp saltpackHeaderPrefix
	if err := codec.NewDecoderBytes(tmp, &mh).Decode(&sphp); err != nil {
		return false
	}
	if sphp.FormatName != saltpack.FormatName {
		return false
	}
	switch sphp.Type {
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

func matchesSaltpackType(messageStart string, typeString string) bool {
	exp := "^\\s*BEGIN ([a-zA-Z0-9]+ )?SALTPACK " + typeString + "."
	match, err := regexp.MatchString(exp, messageStart)
	return match && (err == nil)
}

func isUTF16Mark(b []byte) bool {
	if len(b) < 2 {
		return false
	}
	return ((b[0] == 0xFE && b[1] == 0xFF) || (b[0] == 0xFF && b[1] == 0xFE))
}

var encryptionArmorHeader = saltpack.MakeArmorHeader(saltpack.MessageTypeEncryption, KeybaseSaltpackBrand)
var signedArmorHeader = saltpack.MakeArmorHeader(saltpack.MessageTypeAttachedSignature, KeybaseSaltpackBrand)
var detachedArmorHeader = saltpack.MakeArmorHeader(saltpack.MessageTypeDetachedSignature, KeybaseSaltpackBrand)

// ClassifyStream takes a stream reader in, and returns a likely classification
// of that stream without consuming any data from it. It returns a reader that you
// should read from instead, in addition to the classification. If classification
// fails, there will be a `UnknownStreamError`, or additional EOF errors if the
// stream ended beform classification could go.
func ClassifyStream(r io.Reader) (sc StreamClassification, out io.Reader, err error) {
	peeker := NewStreamPeeker(r)
	var buf [100]byte
	var n int
	if n, err = peeker.Peek(buf[:]); err != nil {
		// ErrUnexpectedEOF might just mean we read less than 100 bytes
		if err == io.ErrUnexpectedEOF && len(buf) > 0 {
			err = nil
		} else {
			return sc, peeker, err
		}
	}
	sb := string(buf[:n])
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
	case matchesSaltpackType(sb, saltpack.EncryptionArmorString):
		sc.Format = CryptoMessageFormatSaltpack
		sc.Armored = true
		sc.Type = CryptoMessageTypeEncryption
	case matchesSaltpackType(sb, saltpack.SignedArmorString):
		sc.Format = CryptoMessageFormatSaltpack
		sc.Armored = true
		sc.Type = CryptoMessageTypeSignature
	case matchesSaltpackType(sb, saltpack.DetachedSignatureArmorString):
		sc.Format = CryptoMessageFormatSaltpack
		sc.Armored = true
		sc.Type = CryptoMessageTypeDetachedSignature
	case isBase64KeybaseV0Sig(sb):
		sc.Format = CryptoMessageFormatKeybaseV0
		sc.Armored = true
		sc.Type = CryptoMessageTypeAttachedSignature
	case isSaltpackBinary(buf[:n], &sc):
		// Format etc. set by isSaltpackBinary().
	case isPGPBinary(buf[:n], &sc):
		// Format etc. set by isPGPBinary().
	case isUTF16Mark(buf[:n]):
		err = UTF16UnsupportedError{}
	default:
		err = UnknownStreamError{}
	}
	return sc, peeker, err
}
