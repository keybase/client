package libkb

//
// Code for encoding and decoding P3SKB-formatted keys. Also works for decoding
// general Keybase Packet types, but we only have P3SKB at present
//

import (
	"bytes"
	"fmt"
	"github.com/keybase/go-triplesec"
)

type P3SKB struct {
	Priv P3SKBPriv `codec:"priv"`
	Pub  []byte    `codec:"pub"`

	decodedPub  *PgpKeyBundle
	decodedPriv *PgpKeyBundle
}

type P3SKBPriv struct {
	Data       []byte `codec:"data"`
	Encryption int    `codec:"encryption"`
}

func (key *PgpKeyBundle) ToPacket(tsec *triplesec.Cipher) (ret *KeybasePacket, err error) {
	ret = &KeybasePacket{
		Version: KEYBASE_PACKET_V1,
		Tag:     TAG_P3SKB, // Keybase tags starts at 513 (OpenPGP are 0-30)
	}
	body := &P3SKB{}

	var buf bytes.Buffer
	key.PrimaryKey.Serialize(&buf)
	body.Pub = buf.Bytes()

	buf.Reset()
	key.PrivateKey.Serialize(&buf)
	if tsec != nil {
		body.Priv.Data, err = tsec.Encrypt(buf.Bytes())
		body.Priv.Encryption = int(triplesec.Version) // Version 3 is the current TripleSec version
		if err != nil {
			return
		}
	} else {
		body.Priv.Data = buf.Bytes()
		body.Priv.Encryption = 0
	}

	ret.Body = body
	err = ret.HashMe()

	return
}

func (p *P3SKB) GetPubKey() (key *PgpKeyBundle, err error) {
	if p.decodedPub == nil {
		key, err = ReadOneKeyFromBytes(p.Pub)
		p.decodedPub = key
	}
	return
}

type P3SKBKeyringFile struct {
	filename         string
	Blocks           []*KeybasePacket
	indexId          map[string]*P3SKB // Map of 64-bit uppercase-hex KeyIds
	indexFingerprint map[PgpFingerprint]*P3SKB
}

func (p KeybasePacket) ToP3SKB() (*P3SKB, error) {
	ret, ok := p.Body.(*P3SKB)
	if !ok {
		return nil, fmt.Errorf("Bad P3SKB packet")
	} else {
		return ret, nil
	}
}

func (f *P3SKBKeyringFile) Push(p *KeybasePacket) error {
	p3skb, err := p.ToP3SKB()
	if err != nil {
		return err
	}
	k, err := p3skb.GetPubKey()
	if err != nil {
		return err
	}
	f.Blocks = append(f.Blocks, p)
	id := k.PrimaryKey.KeyIdString()
	fp := PgpFingerprint(k.PrimaryKey.Fingerprint)
	f.indexId[id] = p3skb
	f.indexFingerprint[fp] = p3skb
	return nil
}
