package libkb

import (
	"bytes"
	"crypto/sha256"
	"github.com/keybase/go-triplesec"
	"github.com/ugorji/go/codec"
)

var (
	mh codec.MsgpackHandle
)

type KeybasePacketHash struct {
	typ   int `codec:"type"`
	value []byte
}

type KeybasePacket struct {
	version int
	tag     int
	hash    KeybasePacketHash
	body    interface{}
}

type P3SKBBody struct {
	pub  []byte
	priv P3SKBPriv
}

type P3SKBPriv struct {
	data       []byte
	encryption int
}

func KeyBundleToP3SKB(key *PgpKeyBundle, tsec *triplesec.Cipher) (ret *KeybasePacket, err error) {
	ret = &KeybasePacket{
		version: 1,
		tag:     513, // Keybase tags starts at 513 (OpenPGP are 0-30)
		hash: KeybasePacketHash{
			typ: 8, // The openpgp encoding for SHA256
		},
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
	zb := [0]byte{}
	ret.hash.value = zb[:]

	var encoded []byte
	if encoded, err = ret.Encode(); err != nil {
		return
	}

	sum := sha256.Sum256(encoded)
	ret.hash.value = sum[:]

	return
}

func (p *KeybasePacket) Encode() ([]byte, error) {
	var encoded []byte
	err := codec.NewEncoderBytes(&encoded, &mh).Encode(p)
	return encoded, err
}
