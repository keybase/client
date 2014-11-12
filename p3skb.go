package libkb

//
// Code for encoding and decoding P3SKB-formatted keys. Also works for decoding
// general Keybase Packet types, but we only have P3SKB at present
//

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"github.com/keybase/go-triplesec"
	"golang.org/x/crypto/openpgp"
	"io"
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

func (key *PgpKeyBundle) ToP3SKB(tsec *triplesec.Cipher) (ret *P3SKB, err error) {

	ret = &P3SKB{}

	var buf bytes.Buffer
	(*openpgp.Entity)(key).Serialize(&buf)
	ret.Pub = buf.Bytes()

	buf.Reset()
	(*openpgp.Entity)(key).SerializePrivate(&buf, nil)
	if tsec != nil {
		ret.Priv.Data, err = tsec.Encrypt(buf.Bytes())
		ret.Priv.Encryption = int(triplesec.Version) // Version 3 is the current TripleSec version
		if err != nil {
			return
		}
	} else {
		ret.Priv.Data = buf.Bytes()
		ret.Priv.Encryption = 0
	}
	return
}

func (p *P3SKB) ToPacket() (ret *KeybasePacket, err error) {
	ret = &KeybasePacket{
		Version: KEYBASE_PACKET_V1,
		Tag:     TAG_P3SKB, // Keybase tags starts at 513 (OpenPGP are 0-30)
	}
	ret.Body = p
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
	Blocks           []*P3SKB
	indexId          map[string]*P3SKB // Map of 64-bit uppercase-hex KeyIds
	indexFingerprint map[PgpFingerprint]*P3SKB
	dirty            bool
}

func (p KeybasePacket) ToP3SKB() (*P3SKB, error) {
	ret, ok := p.Body.(*P3SKB)
	if !ok {
		return nil, fmt.Errorf("Bad P3SKB packet")
	} else {
		return ret, nil
	}
}

func (f *P3SKBKeyringFile) Push(p3skb *P3SKB) error {
	k, err := p3skb.GetPubKey()
	if err != nil {
		return err
	}
	f.dirty = true
	f.Blocks = append(f.Blocks, p3skb)
	id := k.PrimaryKey.KeyIdString()
	fp := PgpFingerprint(k.PrimaryKey.Fingerprint)
	f.indexId[id] = p3skb
	f.indexFingerprint[fp] = p3skb
	return nil
}

func (f P3SKBKeyringFile) GetFilename() string { return f.filename }

func (f P3SKBKeyringFile) WriteTo(w io.Writer) error {
	packets := make(KeybasePackets, len(f.Blocks))
	var err error
	for i, b := range f.Blocks {
		if packets[i], err = b.ToPacket(); err != nil {
			return err
		}
	}
	b64 := base64.NewEncoder(base64.StdEncoding, w)
	if err = packets.EncodeTo(b64); err != nil {
		return err
	}
	b64.Close()
	return nil
}

func (f *P3SKBKeyringFile) Save() error {
	if !f.dirty {
		return nil
	}
	err := SafeWriteToFile(*f)
	if err != nil {
		f.dirty = false
	}
	return err
}
