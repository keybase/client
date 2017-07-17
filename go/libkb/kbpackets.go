// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

//
// Code for encoding and decoding SKB-formatted keys. Also works for decoding
// general Keybase Packet types, but we only have SKB at present
//

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"

	"github.com/keybase/go-codec/codec"
)

type FishyMsgpackError struct {
	original  []byte
	reencoded []byte
}

func (e FishyMsgpackError) Error() string {
	return fmt.Sprintf("Original msgpack data didn't match re-encoded version: %#v != %#v", e.reencoded, e.original)
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
	Body    interface{}        `codec:"body"`
	Hash    *KeybasePacketHash `codec:"hash,omitempty"`
	Tag     int                `codec:"tag"`
	Version int                `codec:"version"`
}

type KeybasePackets []*KeybasePacket

func NewKeybasePacket(body interface{}, tag int, version int) (*KeybasePacket, error) {
	ret := KeybasePacket{
		Body:    body,
		Tag:     tag,
		Version: version,
	}

	hashBytes, hashErr := ret.hashToBytes()
	if hashErr != nil {
		return nil, hashErr
	}
	ret.Hash = &KeybasePacketHash{
		Type:  SHA256Code,
		Value: hashBytes,
	}
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
	var encoded []byte
	var err error
	if encoded, err = packetCopy.Encode(); err != nil {
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

func (p *KeybasePacket) ArmoredEncode() (ret string, err error) {
	var buf bytes.Buffer
	b64 := base64.NewEncoder(base64.StdEncoding, &buf)
	err = p.EncodeTo(b64)
	b64.Close()
	if err == nil {
		ret = buf.String()
	}
	return
}

func (p *KeybasePacket) EncodeTo(w io.Writer) error {
	err := codec.NewEncoder(w, codecHandle()).Encode(p)
	return err
}

func (p KeybasePackets) Encode() ([]byte, error) {
	var encoded []byte
	err := codec.NewEncoderBytes(&encoded, codecHandle()).Encode(p)
	return encoded, err
}

func (p KeybasePackets) EncodeTo(w io.Writer) error {
	err := codec.NewEncoder(w, codecHandle()).Encode(p)
	return err
}

func MsgpackDecode(dst interface{}, src []byte) (err error) {
	buf := bytes.NewBuffer(src)
	ch := codecHandle()
	return codec.NewDecoder(buf, ch).Decode(dst)
}

func MsgpackEncode(src interface{}) (dst []byte, err error) {
	ch := codecHandle()
	err = codec.NewEncoderBytes(&dst, ch).Encode(src)
	return dst, err
}

// DecodePacketsUnchecked decodes an array of packets from `reader`. It does *not*
// check that the stream was canonical msgpack.
func DecodePacketsUnchecked(reader io.Reader) (ret KeybasePackets, err error) {
	ch := codecHandle()
	if err = codec.NewDecoder(reader, ch).Decode(&ret); err != nil {
		return
	}
	for _, p := range ret {
		err = p.unpackBody(ch)
		if err != nil {
			return
		}
	}
	return
}

// Decode data into out, but make sure that all bytes in data are
// used.
func MsgpackDecodeAll(data []byte, handle *codec.MsgpackHandle, out interface{}) error {
	buf := bytes.NewBuffer(data)
	err := codec.NewDecoder(buf, handle).Decode(out)
	if err != nil {
		return err
	}
	if buf.Len() > 0 {
		return fmt.Errorf("Did not consume entire buffer: %d byte(s) left", buf.Len())
	}
	return nil
}

func (p *KeybasePacket) unpackBody(ch *codec.MsgpackHandle) error {
	var body interface{}

	switch p.Tag {
	case TagP3skb:
		// XXX this function should get a G passed into it, but to do that requires
		// a lot of changes upstream.
		body = NewSKB(G)
	case TagSignature:
		body = &NaclSigInfo{}
	case TagEncryption:
		body = &NaclEncryptionInfo{}
	default:
		return fmt.Errorf("Unknown packet tag: %d", p.Tag)
	}
	var encoded []byte
	if err := codec.NewEncoderBytes(&encoded, ch).Encode(p.Body); err != nil {
		return err
	}
	if err := MsgpackDecodeAll(encoded, ch, body); err != nil {
		return err
	}
	p.Body = body

	return nil
}

func (p *KeybasePacket) unmarshalBinary(data []byte) error {
	ch := codecHandle()
	if err := MsgpackDecodeAll(data, ch, p); err != nil {
		return err
	}

	if err := p.unpackBody(ch); err != nil {
		return err
	}

	// Test for nonstandard msgpack data (which could be maliciously crafted)
	// by re-encoding and making sure we get the same thing.
	// https://github.com/keybase/client/issues/423
	//
	// Ideally this should be done at a lower level, like MsgpackDecodeAll, but
	// our msgpack library doesn't sort maps the way we expect. See
	// https://github.com/ugorji/go/issues/103
	var reencoded []byte
	if err := codec.NewEncoderBytes(&reencoded, ch).Encode(p); err != nil {
		return err
	}

	if reencoded, err := p.Encode(); err != nil {
		return err
	} else if !bytes.Equal(reencoded, data) {
		return FishyMsgpackError{data, reencoded}
	}

	return p.checkHash()
}

func DecodeArmoredPacket(s string) (*KeybasePacket, error) {
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return nil, err
	}
	return DecodePacket(b)
}

func DecodePacket(data []byte) (ret *KeybasePacket, err error) {
	ret = &KeybasePacket{}
	err = ret.unmarshalBinary(data)
	if err != nil {
		ret = nil
	}
	return
}

type Packetable interface {
	ToPacket() (*KeybasePacket, error)
}

func PacketArmoredEncode(p Packetable) (ret string, err error) {
	var tmp *KeybasePacket
	if tmp, err = p.ToPacket(); err == nil {
		ret, err = tmp.ArmoredEncode()
	}
	return
}
