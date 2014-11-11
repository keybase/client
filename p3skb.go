package libkb

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"github.com/keybase/go-triplesec"
	"github.com/ugorji/go/codec"
)

func CodecHandle() *codec.MsgpackHandle {
	var mh codec.MsgpackHandle
	mh.WriteExt = true
	return &mh
}

var SHA256_CODE int = 8

type KeybasePacketHash struct {
	Type  int    `codec:"type"`
	Value []byte `codec:"value"`
}

type KeybasePacket struct {
	Body    interface{}       `codec:"body"`
	Hash    KeybasePacketHash `codec:"hash"`
	Tag     int               `codec:"tag"`
	Version int               `codec:"version"`
}

type P3SKBBody struct {
	Priv P3SKBPriv `codec:"priv"`
	Pub  []byte    `codec:"pub"`
}

type P3SKBPriv struct {
	Data       []byte `codec:"data"`
	Encryption int    `codec:"encryption"`
}

func KeyBundleToP3SKB(key *PgpKeyBundle, tsec *triplesec.Cipher) (ret *KeybasePacket, err error) {
	ret = &KeybasePacket{
		Version: KEYBASE_PACKET_V1,
		Tag:     TAG_P3SKB, // Keybase tags starts at 513 (OpenPGP are 0-30)
	}
	body := &P3SKBBody{
		Priv: P3SKBPriv{
			Encryption: int(triplesec.Version), // Version 3 is the current TripleSec version
		},
	}
	var buf bytes.Buffer
	key.PrimaryKey.Serialize(&buf)
	body.Pub = buf.Bytes()

	buf.Reset()
	key.PrivateKey.Serialize(&buf)
	body.Priv.Data, err = tsec.Encrypt(buf.Bytes())
	if err != nil {
		return
	}

	ret.Body = body
	err = ret.HashMe()

	return
}

func (p *KeybasePacket) HashToBytes() (ret []byte, err error) {
	zb := [0]byte{}
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
	fmt.Printf(base64.StdEncoding.EncodeToString(encoded))

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

func DecodePacket(data []byte) (ret *KeybasePacket, err error) {
	defer func() {
		if err != nil {
			ret = nil
		}
	}()

	ret = &KeybasePacket{}
	err = codec.NewDecoderBytes(data, CodecHandle()).Decode(ret)
	if err != nil {
		return
	}

	var body interface{}

	switch ret.Tag {
	case TAG_P3SKB:
		body = &P3SKBBody{}
	default:
		err = fmt.Errorf("Unknown packet tag: %d", ret.Tag)
		return
	}
	var encoded []byte
	err = codec.NewEncoderBytes(&encoded, CodecHandle()).Encode(ret.Body)
	if err != nil {
		return
	}
	err = codec.NewDecoderBytes(encoded, CodecHandle()).Decode(body)
	if err != nil {
		return
	}
	ret.Body = body
	if err = ret.CheckHash(); err != nil {
		return
	}

	return
}
