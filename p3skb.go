package libkb

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"github.com/keybase/go-triplesec"
	"github.com/ugorji/go/codec"
)

var (
	mh codec.MsgpackHandle
)

var SHA256_CODE int = 8

type KeybasePacketHash struct {
	typ   int `codec:"type"`
	value []byte
}

type KeybasePacket struct {
	body    interface{}
	hash    KeybasePacketHash
	tag     int
	version int
}

type P3SKBBody struct {
	priv P3SKBPriv
	pub  []byte
}

type P3SKBPriv struct {
	data       []byte
	encryption int
}

func KeyBundleToP3SKB(key *PgpKeyBundle, tsec *triplesec.Cipher) (ret *KeybasePacket, err error) {
	ret = &KeybasePacket{
		version: KEYBASE_PACKET_V1,
		tag:     TAG_P3SKB, // Keybase tags starts at 513 (OpenPGP are 0-30)
	}
	body := &P3SKBBody{
		priv: P3SKBPriv{
			encryption: int(triplesec.Version), // Version 3 is the current TripleSec version
		},
	}
	var buf bytes.Buffer
	key.PrimaryKey.Serialize(&buf)
	body.pub = buf.Bytes()

	buf.Reset()
	key.PrivateKey.Serialize(&buf)
	body.priv.data, err = tsec.Encrypt(buf.Bytes())
	if err != nil {
		return
	}

	ret.body = body
	ret.hash.value, err = ret.Hash()

	return
}

func (p *KeybasePacket) Hash() (ret []byte, err error) {
	zb := [0]byte{}
	tmp := p.hash.value
	defer func() {
		p.hash.value = tmp
	}()
	p.hash.value = zb[:]
	p.hash.typ = SHA256_CODE

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
	p.hash.value, err = p.Hash()
	return err
}

func (p *KeybasePacket) CheckHash() error {
	var gotten []byte
	var err error
	given := p.hash.value
	if p.hash.typ != SHA256_CODE {
		err = fmt.Errorf("Bad hash code: %d", p.hash.typ)
	} else if gotten, err = p.Hash(); err != nil {

	} else if !FastByteArrayEq(gotten, given) {
		err = fmt.Errorf("Bad packet hash")
	}
	return err
}

func (p *KeybasePacket) Encode() ([]byte, error) {
	var encoded []byte
	err := codec.NewEncoderBytes(&encoded, &mh).Encode(p)
	return encoded, err
}

func DecodePacket(data []byte) (ret *KeybasePacket, err error) {
	defer func() {
		if err != nil {
			ret = nil
		}
	}()

	var gen interface{}
	err = codec.NewDecoderBytes(data, &mh).Decode(&gen)
	if err != nil {
		return
	}

	var body interface{}

	switch ret.tag {
	case TAG_P3SKB:
		body = &P3SKBBody{}
	default:
		err = fmt.Errorf("Unknown packet tag: %d", ret.tag)
		return
	}
	var encoded []byte
	err = codec.NewEncoderBytes(&encoded, &mh).Encode(ret.body)
	if err != nil {
		return
	}
	err = codec.NewDecoderBytes(encoded, &mh).Decode(body)
	if err != nil {
		return
	}
	ret.body = body
	if err = ret.CheckHash(); err != nil {
		return
	}

	return
}
