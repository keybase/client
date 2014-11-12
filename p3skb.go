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
	"os"
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

	var pk, sk bytes.Buffer

	// Need to serialize Private first, because
	err = (*openpgp.Entity)(key).SerializePrivate(&sk, nil)
	if err != nil {
		return
	}
	if tsec != nil {
		ret.Priv.Data, err = tsec.Encrypt(sk.Bytes())
		ret.Priv.Encryption = int(triplesec.Version) // Version 3 is the current TripleSec version
		if err != nil {
			return
		}
	} else {
		ret.Priv.Data = sk.Bytes()
		ret.Priv.Encryption = 0
	}

	err = (*openpgp.Entity)(key).Serialize(&pk)
	if err != nil {
		return
	}
	ret.Pub = pk.Bytes()

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
	filename string
	Blocks   []*P3SKB
	index    map[PgpFingerprint]*P3SKB
	dirty    bool
}

func NewP3SKBKeyringFile(n string) *P3SKBKeyringFile {
	return &P3SKBKeyringFile{
		filename: n,
		Blocks:   make([]*P3SKB, 0, 1),
		index:    make(map[PgpFingerprint]*P3SKB),
		dirty:    false,
	}
}

func (k *P3SKBKeyringFile) Load() (err error) {
	G.Log.Debug("+ Loading P3SKB keyring: %s", k.filename)
	var packets KeybasePackets
	var file *os.File
	if file, err = os.OpenFile(k.filename, os.O_RDONLY, 0); err == nil {
		packets, err = DecodePackets(file)
		tmp := file.Close()
		if err == nil && tmp != nil {
			err = tmp
		}
	}

	if err != nil {
		if os.IsNotExist(err) {
			G.Log.Debug("| Keybase secret keyring doesn't exist: %s", k.filename)
		} else {
			G.Log.Warning("Error opening %s: %s", k.filename, err.Error())
		}

	} else if err == nil {
		k.Blocks, err = packets.ToListOfP3SKBs()
	}

	G.Log.Debug("- Loaded P3SKB keyring: %s -> %s", k.filename, ErrToOk(err))
	return
}

func (k *P3SKBKeyringFile) Index() (err error) {
	for _, b := range k.Blocks {
		var key *PgpKeyBundle
		key, err = b.GetPubKey()
		if err != nil {
			return
		}
		fp := key.GetFingerprint()
		k.index[fp] = b
	}
	G.Log.Debug("| Indexed %d secret keys", len(k.Blocks))
	return
}

func (k *P3SKBKeyringFile) LoadAndIndex() error {
	err := k.Load()
	if err == nil {
		err = k.Index()
	}
	return err
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
		return fmt.Errorf("Failed to get pubkey: %s", err.Error())
	}
	f.dirty = true
	f.Blocks = append(f.Blocks, p3skb)
	fp := PgpFingerprint(k.PrimaryKey.Fingerprint)
	f.index[fp] = p3skb
	return nil
}

func (f P3SKBKeyringFile) GetFilename() string { return f.filename }

func (f P3SKBKeyringFile) WriteTo(w io.Writer) error {
	G.Log.Debug("+ WriteTo")
	packets := make(KeybasePackets, len(f.Blocks))
	var err error
	for i, b := range f.Blocks {
		if packets[i], err = b.ToPacket(); err != nil {
			return err
		}
	}
	b64 := base64.NewEncoder(base64.StdEncoding, w)
	if err = packets.EncodeTo(b64); err != nil {
		G.Log.Warning("Encoding problem: %s", err.Error())
		return err
	}
	G.Log.Debug("- WriteTo")
	b64.Close()
	return nil
}

func (f *P3SKBKeyringFile) Save() error {
	if !f.dirty {
		return nil
	}
	G.Log.Debug("shiiit")
	err := SafeWriteToFile(*f)
	if err == nil {
		f.dirty = false
	}
	return err
}

func (p KeybasePackets) ToListOfP3SKBs() (ret []*P3SKB, err error) {
	ret = make([]*P3SKB, len(p))
	for i, e := range p {
		if k, ok := e.Body.(*P3SKB); ok {
			ret[i] = k
		} else {
			err = fmt.Errorf("Bad P3SKB sequence; got packet of wrong type")
			ret = nil
			break
		}
	}
	return
}
