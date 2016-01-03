// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"encoding/base64"
	"errors"
	"github.com/keybase/client/go/saltpack"
	"github.com/ugorji/go/codec"
	"io"
	"strings"
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
	p.buf = append(p.buf, buf...)
	return n, err
}

// CryptoMessageFormat is one of the known crypto message formats that we admit
type CryptoMessageFormat int

const (
	// CryptoMessageFormatPGP is for PGP
	CryptoMessageFormatPGP CryptoMessageFormat = 0
	// CryptoMessageFormatKeybaseV0 is for the zeroth version of Keybase signatures, which
	// will eventually be deprecated.
	CryptoMessageFormatKeybaseV0 CryptoMessageFormat = 1
	// CryptoMessageFormatSaltPack is the SaltPack messaging format for encrypted and signed
	// messages
	CryptoMessageFormatSaltPack CryptoMessageFormat = 2
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
	// CryptoMessageTypeAmbiguous is for an ambiguous message based on the stream prefix
	CryptoMessageTypeAmbiguous = 3
	// CryptoMessageTypeSignature is for a sig that can be either attached or detached
	CryptoMessageTypeSignature = 4
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
type saltPackHeaderPrefix struct {
	_struct    bool                 `codec:",toarray"`
	FormatName string               `codec:"format_name"`
	Version    saltpack.Version     `codec:"vers"`
	Type       saltpack.MessageType `codec:"type"`
}

func isSaltPackBinary(b []byte, sc *StreamClassification) bool {
	if len(b) < 2 {
		return false
	}

	if b[0] <= 0x92 || b[0] >= 0x9a {
		return false
	}
	tmp := make([]byte, len(b))
	copy(tmp, b)

	// Hack -- make this a 3-value Msgpack Array, since we only care about the
	// first 3 fields, and don't want to bother slurping in more than that.
	tmp[0] = 0x93
	var mh codec.MsgpackHandle
	var sphp saltPackHeaderPrefix
	if err := codec.NewDecoderBytes(tmp, &mh).Decode(&sphp); err != nil {
		return false
	}
	if sphp.FormatName != saltpack.SaltPackFormatName {
		return false
	}
	switch sphp.Type {
	case saltpack.MessageTypeEncryption:
		sc.Type = CryptoMessageTypeEncryption
	case saltpack.MessageTypeAttachedSignature:
		sc.Type = CryptoMessageTypeAttachedSignature
	case saltpack.MessageTypeDetachedSignature:
		sc.Type = CryptoMessageTypeDetachedSignature
	default:
		return false
	}
	sc.Format = CryptoMessageFormatSaltPack
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

// ClassifyStream takes a stream reader in, and returns a likely classification
// of that stream without consuming an data from it. It returns a reader that you
// should read from instead, in addition to the classification. If classification
// fails, there will be a `UnknownStreamError`, or additional EOF errors if the
// stream ended beform classification could go.
func ClassifyStream(r io.Reader) (sc StreamClassification, out io.Reader, err error) {
	peeker := NewStreamPeeker(r)
	var buf [100]byte
	var n int
	if n, err = peeker.Peek(buf[:]); err != nil {
		return sc, peeker, err
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
	case strings.HasPrefix(sb, "BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE."):
		sc.Format = CryptoMessageFormatSaltPack
		sc.Armored = true
		sc.Type = CryptoMessageTypeEncryption
	case strings.HasPrefix(sb, "BEGIN KEYBASE SALTPACK SIGNED MESSAGE."):
		sc.Format = CryptoMessageFormatSaltPack
		sc.Armored = true
		sc.Type = CryptoMessageTypeSignature
	case isBase64KeybaseV0Sig(sb):
		sc.Format = CryptoMessageFormatKeybaseV0
		sc.Armored = true
		sc.Type = CryptoMessageTypeAttachedSignature
	case isSaltPackBinary(buf[:n], &sc):
	case isPGPBinary(buf[:n], &sc):
	default:
		err = UnknownStreamError{}
	}
	return sc, peeker, err
}
