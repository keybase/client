package libkb

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"github.com/keybase/go-jsonw"
)

const (
	LINK_ID_LEN = 32
)

type LinkId []byte

func GetLinkId(w *jsonw.Wrapper) (LinkId, error) {
	if w.IsNil() {
		return nil, nil
	}
	s, err := w.GetString()
	if err != nil {
		return nil, err
	}
	ret, err := LinkIdFromHex(s)
	return ret, err
}

func GetLinkIdVoid(w *jsonw.Wrapper, l *LinkId, e *error) {
	ret, err := GetLinkId(w)
	if err != nil {
		*e = err
	} else {
		*l = ret
	}
}

func LinkIdFromHex(s string) (LinkId, error) {
	bv, err := hex.DecodeString(s)
	if err == nil && len(bv) != LINK_ID_LEN {
		err = fmt.Errorf("Bad link ID; wrong length: %d", len(bv))
		bv = nil
	}
	var ret LinkId
	if bv != nil {
		ret = LinkId(bv)
	}
	return ret, err
}

func (p LinkId) ToString() string {
	return hex.EncodeToString(p)
}

type ChainLinkUnpacked struct {
	prev           LinkId
	seqno          int
	payloadJsonStr string
	ctime, etime   int64
	pgpFingerprint PgpFingerprint
	sig            string
	sigType        int
	sigId          string
	sigIdShort     string
}

type ChainLink struct {
	id           LinkId
	hashVerified bool
	sigVerified  bool

	packed      *jsonw.Wrapper
	payloadJson *jsonw.Wrapper
	unpacked    *ChainLinkUnpacked
}

func (c ChainLink) Prev() LinkId {
	return nil
}

func (c *ChainLink) Unpack() (err error) {
	tmp := ChainLinkUnpacked{}

	c.packed.AtKey("payload_json").GetStringVoid(&tmp.payloadJsonStr, &err)
	GetPgpFingerprintVoid(c.packed.AtKey("fingerprint"), &tmp.pgpFingerprint, &err)
	c.packed.AtKey("sig").GetStringVoid(&tmp.sig, &err)
	c.packed.AtKey("sig_id").GetStringVoid(&tmp.sigId, &err)
	c.packed.AtKey("sig_id_short").GetStringVoid(&tmp.sigIdShort, &err)

	if err != nil {
		return err
	}

	c.payloadJson, err = jsonw.Unmarshal([]byte(tmp.payloadJsonStr))
	GetLinkIdVoid(c.payloadJson.AtKey("prev"), &tmp.prev, &err)
	c.payloadJson.AtKey("seqno").GetIntVoid(&tmp.seqno, &err)
	c.payloadJson.AtKey("ctime").GetInt64Void(&tmp.ctime, &err)

	var ei int64
	c.packed.AtKey("expire_in").GetInt64Void(&ei, &err)
	tmp.etime = tmp.ctime + ei

	if err != nil {
		c.unpacked = &tmp
	}

	return err
}

func (c *ChainLink) VerifyHash() error {
	if c.hashVerified {
		return nil
	}

	h := sha256.Sum256([]byte(c.unpacked.payloadJsonStr))
	if !FastByteArrayEq(h[:], c.id) {
		return fmt.Errorf("hash mismatch")
	}
	c.hashVerified = true
	return nil
}

func (c *ChainLink) VerifySig() error {
	return nil
}

func LoadLinkFromStorage(id LinkId) (*ChainLink, error) {
	jw, err := G.LocalDb.Get(DbKey{Typ: DB_LINK, Key: id.ToString()})
	var ret *ChainLink
	if err == nil {
		// May as well recheck onload (maybe revisit this)
		ret = &ChainLink{id, false, false, jw, nil, nil}
		if err = ret.Unpack(); err != nil {
			ret = nil
		}
	}
	return ret, err
}
