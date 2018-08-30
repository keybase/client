// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

// Code for encoding and decoding Keybase packet types.

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"

	"github.com/keybase/go-codec/codec"
)

type Packetable interface {
	GetTagAndVersion() (PacketTag, PacketVersion)
}

func EncodePacketTo(p Packetable, encoder *codec.Encoder) error {
	packet, err := NewKeybasePacket(p)
	if err != nil {
		return err
	}
	return encoder.Encode(packet)
}

func EncodePacket(p Packetable) ([]byte, error) {
	packet, err := NewKeybasePacket(p)
	if err != nil {
		return nil, err
	}
	return packet.Encode()
}

func PacketArmoredEncode(p Packetable) (string, error) {
	packet, err := NewKeybasePacket(p)
	if err != nil {
		return "", err
	}
	return packet.ArmoredEncode()
}

type FishyMsgpackError struct {
	original  []byte
	reencoded []byte
}

func (e FishyMsgpackError) Error() string {
	return fmt.Sprintf("Original msgpack data didn't match re-encoded version: reencoded=%x != original=%x", e.reencoded, e.original)
}

func codecHandle() *codec.MsgpackHandle {
	var mh codec.MsgpackHandle
	mh.WriteExt = true
	return &mh
}

const SHA256Code = 8

type KeybasePacketHash struct {
	Type  int    `codec:"type"`
	Value []byte `codec:"value"`
}

type KeybasePacket struct {
	Body    Packetable         `codec:"body"`
	Hash    *KeybasePacketHash `codec:"hash,omitempty"`
	Tag     PacketTag          `codec:"tag"`
	Version PacketVersion      `codec:"version"`
}

func NewKeybasePacket(body Packetable) (*KeybasePacket, error) {
	tag, version := body.GetTagAndVersion()
	ret := KeybasePacket{
		Body:    body,
		Tag:     tag,
		Version: version,
		Hash: &KeybasePacketHash{
			Type:  SHA256Code,
			Value: []byte{},
		},
	}

	hashBytes, hashErr := ret.hashSum()
	if hashErr != nil {
		return nil, hashErr
	}
	ret.Hash.Value = hashBytes
	return &ret, nil
}

func (p *KeybasePacket) hashToBytes() ([]byte, error) {
	// We don't include the Hash field in the encoded bytes that we hash,
	// because if we did then the result wouldn't be stable. To work around
	// that, we make a copy of the packet and overwrite the Hash field with
	// an empty slice.
	packetCopy := *p
	packetCopy.Hash = &KeybasePacketHash{
		Type:  SHA256Code,
		Value: []byte{},
	}
	return packetCopy.hashSum()
}

func (p *KeybasePacket) hashSum() ([]byte, error) {
	if len(p.Hash.Value) != 0 {
		return nil, errors.New("cannot compute hash with Value present")
	}
	encoded, err := p.Encode()
	if err != nil {
		return nil, err
	}
	ret := sha256.Sum256(encoded)
	return ret[:], nil
}

func (p *KeybasePacket) checkHash() error {
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

func (p *KeybasePacket) Encode() ([]byte, error) {
	var encoded []byte
	err := codec.NewEncoderBytes(&encoded, codecHandle()).Encode(p)
	return encoded, err
}

func (p *KeybasePacket) ArmoredEncode() (string, error) {
	var buf bytes.Buffer
	err := func() (err error) {
		b64 := base64.NewEncoder(base64.StdEncoding, &buf)
		defer func() {
			closeErr := b64.Close()
			if err == nil {
				err = closeErr
			}
		}()
		encoder := codec.NewEncoder(b64, codecHandle())
		return encoder.Encode(p)
	}()
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}

func (p *KeybasePacket) EncodeTo(w io.Writer) error {
	err := codec.NewEncoder(w, codecHandle()).Encode(p)
	return err
}

func DecodePacket(decoder *codec.Decoder, body Packetable) error {
	// TODO: Do something with the version too?
	tag, _ := body.GetTagAndVersion()
	p := KeybasePacket{
		Body: body,
	}
	err := decoder.Decode(&p)
	if err != nil {
		return err
	}

	if p.Tag != tag {
		return UnmarshalError{ExpectedTag: p.Tag, Tag: tag}
	}

	return p.checkHash()
}

func DecodePacketBytes(data []byte, body Packetable) error {
	ch := codecHandle()
	decoder := codec.NewDecoderBytes(data, ch)

	// TODO: Do something with the version too?
	tag, _ := body.GetTagAndVersion()
	p := KeybasePacket{
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
	if reencoded, err := p.Encode(); err != nil {
		return err
	} else if !bytes.Equal(reencoded, data) {
		return FishyMsgpackError{data, reencoded}
	}

	return p.checkHash()
}

func DecodeSKBPacket(data []byte) (*SKB, error) {
	var info SKB
	err := DecodePacketBytes(data, &info)
	if err != nil {
		return nil, err
	}
	return &info, nil
}

func DecodeArmoredSKBPacket(s string) (*SKB, error) {
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return nil, err
	}
	return DecodeSKBPacket(b)
}

func DecodeNaclSigInfoPacket(data []byte) (NaclSigInfo, error) {
	var info NaclSigInfo
	err := DecodePacketBytes(data, &info)
	if err != nil {
		return NaclSigInfo{}, err
	}
	return info, nil
}

func DecodeArmoredNaclSigInfoPacket(s string) (NaclSigInfo, error) {
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return NaclSigInfo{}, err
	}
	return DecodeNaclSigInfoPacket(b)
}

func DecodeNaclEncryptionInfoPacket(data []byte) (NaclEncryptionInfo, error) {
	var info NaclEncryptionInfo
	err := DecodePacketBytes(data, &info)
	if err != nil {
		return NaclEncryptionInfo{}, err
	}
	return info, nil
}

func DecodeArmoredNaclEncryptionInfoPacket(s string) (NaclEncryptionInfo, error) {
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return NaclEncryptionInfo{}, err
	}
	return DecodeNaclEncryptionInfoPacket(b)
}
