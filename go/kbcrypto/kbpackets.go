// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcrypto

// Code for encoding and decoding Keybase packet types.

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/keybase/go-codec/codec"
)

type PacketVersion int

const (
	KeybasePacketV1 PacketVersion = 1
)

// PacketTag are tags for OpenPGP and Keybase packets. It is a uint to
// be backwards compatible with older versions of codec that encoded
// positive ints as uints.
type PacketTag uint

const (
	TagP3skb      PacketTag = 513
	TagSignature  PacketTag = 514
	TagEncryption PacketTag = 515
)

func (t PacketTag) String() string {
	switch t {
	case TagP3skb:
		return "PacketTag(P3skb)"
	case TagSignature:
		return "PacketTag(Signature)"
	case TagEncryption:
		return "PacketTag(Encryption)"
	default:
		return fmt.Sprintf("PacketTag(%d)", uint(t))
	}
}

type Packetable interface {
	GetTagAndVersion() (PacketTag, PacketVersion)
}

func EncodePacket(p Packetable, encoder *codec.Encoder) error {
	packet, err := newKeybasePacket(p, true)
	if err != nil {
		return err
	}
	return encoder.Encode(packet)
}

func EncodePacketToBytes(p Packetable) ([]byte, error) {
	packet, err := newKeybasePacket(p, true)
	if err != nil {
		return nil, err
	}
	return packet.encode()
}

func EncodePacketToBytesWithOptionalHash(p Packetable, doHash bool) ([]byte, error) {
	packet, err := newKeybasePacket(p, doHash)
	if err != nil {
		return nil, err
	}
	return packet.encode()
}

func EncodePacketToArmoredString(p Packetable) (string, error) {
	packet, err := newKeybasePacket(p, true)
	if err != nil {
		return "", err
	}
	return packet.armoredEncode()
}

type UnmarshalError struct {
	ExpectedTag PacketTag
	Tag         PacketTag
}

func (u UnmarshalError) Error() string {
	return fmt.Sprintf("Expected %s packet, got %s packet", u.ExpectedTag, u.Tag)
}

func DecodePacket(decoder *codec.Decoder, body Packetable) error {
	// TODO: Do something with the version too?
	tag, _ := body.GetTagAndVersion()
	p := keybasePacket{
		Body: body,
	}
	err := decoder.Decode(&p)
	if err != nil {
		return err
	}

	if p.Tag != tag {
		return UnmarshalError{ExpectedTag: p.Tag, Tag: tag}
	}

	// TODO: Figure out a way to do the same reencode check as in
	// DecodePacketFromBytes.

	return p.checkHash()
}

func DecodePacketFromBytes(data []byte, body Packetable) error {
	ch := CodecHandle()
	decoder := codec.NewDecoderBytes(data, ch)

	// TODO: Do something with the version too?
	tag, _ := body.GetTagAndVersion()
	p := keybasePacket{
		Body: body,
	}
	err := decoder.Decode(&p)
	if err != nil {
		return err
	}

	if decoder.NumBytesRead() != len(data) {
		return fmt.Errorf("Did not consume entire buffer: %d byte(s) left", len(data)-decoder.NumBytesRead())
	}

	if p.Tag != tag {
		return UnmarshalError{ExpectedTag: p.Tag, Tag: tag}
	}

	// Test for nonstandard msgpack data (which could be maliciously crafted)
	// by re-encoding and making sure we get the same thing.
	// https://github.com/keybase/client/issues/423
	//
	// Ideally this should be done at a lower level, but our
	// msgpack library doesn't sort maps the way we expect. See
	// https://github.com/ugorji/go/issues/103
	if reencoded, err := p.encode(); err != nil {
		return err
	} else if !bytes.Equal(reencoded, data) {
		return FishyMsgpackError{data, reencoded}
	}

	return p.checkHash()
}

type FishyMsgpackError struct {
	original  []byte
	reencoded []byte
}

func (e FishyMsgpackError) Error() string {
	return fmt.Sprintf("Original msgpack data didn't match re-encoded version: reencoded=%x != original=%x", e.reencoded, e.original)
}

func CodecHandle() *codec.MsgpackHandle {
	var mh codec.MsgpackHandle
	mh.WriteExt = true
	return &mh
}

const SHA256Code = 8

type keybasePacketHash struct {
	Type  int    `codec:"type"`
	Value []byte `codec:"value"`
}

type keybasePacket struct {
	Body    Packetable         `codec:"body"`
	Hash    *keybasePacketHash `codec:"hash,omitempty"`
	Tag     PacketTag          `codec:"tag"`
	Version PacketVersion      `codec:"version"`
}

// newKeybasePacket creates a new keybase crypto packet, optionally computing a
// hash over all data in the packet (via doHash). Every client 1.0.17 and above
// provides this flag (implicitly, since before it wasn't optional).  Some 1.0.16
// clients did this, and no clients 1.0.15 and earlier did it. We use the flag
// so that we can generate the legacy hashes for old 1.0.16
func newKeybasePacket(body Packetable, doHash bool) (*keybasePacket, error) {
	tag, version := body.GetTagAndVersion()
	ret := keybasePacket{
		Body:    body,
		Tag:     tag,
		Version: version,
	}
	if doHash {
		ret.Hash = &keybasePacketHash{
			Type:  SHA256Code,
			Value: []byte{},
		}
		hashBytes, hashErr := ret.hashSum()
		if hashErr != nil {
			return nil, hashErr
		}
		ret.Hash.Value = hashBytes
	}
	return &ret, nil
}

func (p *keybasePacket) hashToBytes() ([]byte, error) {
	// We don't include the Hash field in the encoded bytes that we hash,
	// because if we did then the result wouldn't be stable. To work around
	// that, we make a copy of the packet and overwrite the Hash field with
	// an empty slice.
	packetCopy := *p
	packetCopy.Hash = &keybasePacketHash{
		Type:  SHA256Code,
		Value: []byte{},
	}
	return packetCopy.hashSum()
}

func (p *keybasePacket) hashSum() ([]byte, error) {
	if len(p.Hash.Value) != 0 {
		return nil, errors.New("cannot compute hash with Value present")
	}
	encoded, err := p.encode()
	if err != nil {
		return nil, err
	}
	ret := sha256.Sum256(encoded)
	return ret[:], nil
}

func (p *keybasePacket) checkHash() error {
	var gotten []byte
	var err error
	if p.Hash == nil {
		return nil
	}
	given := p.Hash.Value
	if p.Hash.Type != SHA256Code {
		err = fmt.Errorf("Bad hash code: %d", p.Hash.Type)
	} else if gotten, err = p.hashToBytes(); err != nil {

	} else if !FastByteArrayEq(gotten, given) {
		err = fmt.Errorf("Bad packet hash")
	}
	return err
}

func (p *keybasePacket) encode() ([]byte, error) {
	var encoded []byte
	err := codec.NewEncoderBytes(&encoded, CodecHandle()).Encode(p)
	return encoded, err
}

func (p *keybasePacket) armoredEncode() (string, error) {
	var buf bytes.Buffer
	err := func() (err error) {
		b64 := base64.NewEncoder(base64.StdEncoding, &buf)
		defer func() {
			closeErr := b64.Close()
			if err == nil {
				err = closeErr
			}
		}()
		encoder := codec.NewEncoder(b64, CodecHandle())
		return encoder.Encode(p)
	}()
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}
