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

func (i1 LinkId) Eq(i2 LinkId) bool {
	if i1 == nil && i2 == nil {
		return true
	} else if i1 == nil || i2 == nil {
		return false
	} else {
		return FastByteArrayEq(i1[:], i2[:])
	}
}

type ChainLinkUnpacked struct {
	prev           LinkId
	seqno          int
	payloadJsonStr string
	ctime, etime   int64
	pgpFingerprint PgpFingerprint
	sig            string
	sigId          SigId
}

type ChainLink struct {
	id            LinkId
	hashVerified  bool
	sigVerified   bool
	storedLocally bool

	packed      *jsonw.Wrapper
	payloadJson *jsonw.Wrapper
	unpacked    *ChainLinkUnpacked
}

func (c ChainLink) GetPrev() LinkId {
	return c.unpacked.prev
}

func (c *ChainLink) Pack() error {
	p := jsonw.NewDictionary()

	// Store the original JSON string so its order is preserved
	p.SetKey("payload_json", jsonw.NewString(c.unpacked.payloadJsonStr))
	p.SetKey("sig", jsonw.NewString(c.unpacked.sig))
	p.SetKey("sig_id", jsonw.NewString(c.unpacked.sigId.ToString(true)))
	p.SetKey("fingerprint", jsonw.NewString(c.unpacked.pgpFingerprint.ToString()))

	c.packed = p

	return nil
}

func (c ChainLink) PackVerification(jw *jsonw.Wrapper) {
	jw.SetKey("publicKey", jsonw.NewString(c.unpacked.pgpFingerprint.ToString()))
	jw.SetKey("seqno", jsonw.NewInt(c.unpacked.seqno))
	jw.SetKey("last_link", jsonw.NewString(c.id.ToString()))
}

func (c *ChainLink) Unpack() (err error) {
	tmp := ChainLinkUnpacked{}

	c.packed.AtKey("payload_json").GetStringVoid(&tmp.payloadJsonStr, &err)
	GetPgpFingerprintVoid(c.packed.AtKey("fingerprint"), &tmp.pgpFingerprint, &err)
	c.packed.AtKey("sig").GetStringVoid(&tmp.sig, &err)
	GetSigIdVoid(c.packed.AtKey("sig_id"), true, &tmp.sigId, &err)

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

func (c ChainLink) GetSeqno() int {
	if c.unpacked != nil {
		return c.unpacked.seqno
	} else {
		return -1
	}
}

func (c *ChainLink) VerifySig(k PgpKeyBundle) (cached bool, err error) {
	cached = false

	if c.sigVerified {
		cached = true
		return
	}

	if !k.GetFingerprint().Eq(c.unpacked.pgpFingerprint) {
		err = fmt.Errorf("Key fingerprint mismatch")
		return
	}
	if sig_id, e2 := k.Verify(c.unpacked.sig,
		[]byte(c.unpacked.payloadJsonStr)); e2 != nil {
		err = e2
		return
	} else {
		c.unpacked.sigId = *sig_id
	}

	c.sigVerified = true
	return
}

func LoadLinkFromServer(jw *jsonw.Wrapper) (ret *ChainLink, err error) {
	var id LinkId
	GetLinkIdVoid(jw.AtKey("payload_hash"), &id, &err)
	if err != nil {
		return
	}
	ret = NewChainLink(id, jw)
	if err = ret.Unpack(); err != nil {
		ret = nil
	}
	return
}

func NewChainLink(id LinkId, jw *jsonw.Wrapper) *ChainLink {
	return &ChainLink{id, false, false, false, jw, nil, nil}
}

func LoadLinkFromStorage(id LinkId) (*ChainLink, error) {
	jw, err := G.LocalDb.Get(DbKey{Typ: DB_LINK, Key: id.ToString()})
	var ret *ChainLink
	if err == nil {
		// May as well recheck onload (maybe revisit this)
		ret = NewChainLink(id, jw)
		if err = ret.Unpack(); err != nil {
			ret = nil
		}
		ret.storedLocally = true
	}
	return ret, err
}

func (l *ChainLink) Store() error {
	if l.storedLocally {
		return nil
	}

	if err := l.VerifyHash(); err != nil {
		return err
	}

	if err := l.Pack(); err != nil {
		return err
	}

	key := DbKey{Typ: DB_LINK, Key: l.id.ToString()}

	// Don't write with any aliases
	if err := G.LocalDb.Put(key, []DbKey{}, l.packed); err != nil {
		return err
	}

	l.storedLocally = true
	return nil
}

func (c *ChainLink) GetPgpFingerprint() PgpFingerprint {
	return c.unpacked.pgpFingerprint
}

func (c *ChainLink) MarkVerifiedFromCache(cv *CachedVerification) {
	if c.unpacked.pgpFingerprint.Eq(*cv.publicKey) &&
		c.id.Eq(cv.lastLink) && c.unpacked.seqno == cv.seqno {
		c.sigVerified = true
		G.Log.Debug("Chain link %s marked verified from cache", c.id.ToString())
	}
}
