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

	jsonw "github.com/keybase/go-jsonw"
	"github.com/ugorji/go/codec"
)

func CodecHandle() *codec.MsgpackHandle {
	var mh codec.MsgpackHandle
	mh.WriteExt = true
	return &mh
}

var SHA256_CODE = 8

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

func (p *KeybasePacket) HashToBytes() (ret []byte, err error) {
	zb := [0]byte{}
	if p.Hash == nil {
		p.Hash = &KeybasePacketHash{}
	}
	tmp := p.Hash.Value
	defer func() {
		p.Hash.Value = tmp
	}()
	p.Hash.Value = zb[:]
	p.Hash.Type = SHA256_CODE

	var encoded []byte
	if encoded, err = p.Encode(); err != nil {
		return
	}

	sum := sha256.Sum256(encoded)
	ret = sum[:]
	return
}

func (p *KeybasePacket) HashMe() error {
	var err error
	p.Hash.Value, err = p.HashToBytes()
	return err
}

func (p *KeybasePacket) CheckHash() error {
	var gotten []byte
	var err error
	if p.Hash == nil {
		return nil
	}
	given := p.Hash.Value
	if p.Hash.Type != SHA256_CODE {
		err = fmt.Errorf("Bad hash code: %d", p.Hash.Type)
	} else if gotten, err = p.HashToBytes(); err != nil {

	} else if !FastByteArrayEq(gotten, given) {
		err = fmt.Errorf("Bad packet hash")
	}
	return err
}

func (p *KeybasePacket) Encode() ([]byte, error) {
	var encoded []byte
	err := codec.NewEncoderBytes(&encoded, CodecHandle()).Encode(p)
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
	err := codec.NewEncoder(w, CodecHandle()).Encode(p)
	return err
}

func (p KeybasePackets) Encode() ([]byte, error) {
	var encoded []byte
	err := codec.NewEncoderBytes(&encoded, CodecHandle()).Encode(p)
	return encoded, err
}

func (p KeybasePackets) EncodeTo(w io.Writer) error {
	err := codec.NewEncoder(w, CodecHandle()).Encode(p)
	return err
}

func DecodePackets(reader io.Reader) (ret KeybasePackets, err error) {
	ch := CodecHandle()
	var generics []interface{}
	if err = codec.NewDecoder(reader, ch).Decode(&generics); err != nil {
		return
	}
	ret = make(KeybasePackets, len(generics))
	for i, e := range generics {
		var encoded []byte
		if err = codec.NewEncoderBytes(&encoded, ch).Encode(e); err != nil {
			return
		}
		if ret[i], err = DecodePacket(encoded); err != nil {
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

func (p *KeybasePacket) MyUnmarshalBinary(data []byte) error {
	ch := CodecHandle()
	if err := MsgpackDecodeAll(data, ch, p); err != nil {
		return err
	}

	var body interface{}

	switch p.Tag {
	case TAG_P3SKB:
		body = &SKB{}
	case TAG_SIGNATURE:
		body = &NaclSigInfo{}
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
	return p.CheckHash()
}

func GetPacket(jsonw *jsonw.Wrapper) (*KeybasePacket, error) {
	s, err := jsonw.GetString()
	if err != nil {
		return nil, err
	}
	return DecodeArmoredPacket(s)
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
	err = ret.MyUnmarshalBinary(data)
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
