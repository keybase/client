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
	seqno          Seqno
	payloadJsonStr string
	ctime, etime   int64
	pgpFingerprint PgpFingerprint
	sig            string
	sigId          SigId
	uid            UID
	username       string
}

type ChainLink struct {
	parent        *SigChain
	id            LinkId
	hashVerified  bool
	sigVerified   bool
	storedLocally bool
	activeKey     bool

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
	p.SetKey("sig_verified", jsonw.NewBool(c.sigVerified))

	c.packed = p

	return nil
}

func (c ChainLink) GetRevocations() []*SigId {
	ret := make([]*SigId, 0, 0)
	jw := c.payloadJson.AtKey("body").AtKey("revoke")
	s, err := GetSigId(jw.AtKey("sig_id"), true)
	if err == nil {
		ret = append(ret, s)
	}
	v := jw.AtKey("sig_ids")
	var l int
	l, err = v.Len()
	if err == nil && l > 0 {
		for i := 0; i < l; i++ {
			s, err = GetSigId(v.AtIndex(i), true)
			ret = append(ret, s)
		}
	}
	return ret
}

func (c ChainLink) PackVerification(jw *jsonw.Wrapper) {
	jw.SetKey("publicKey", jsonw.NewString(c.unpacked.pgpFingerprint.ToString()))
	jw.SetKey("seqno", jsonw.NewInt64(int64(c.unpacked.seqno)))
	jw.SetKey("last_link", jsonw.NewString(c.id.ToString()))
}

func (c ChainLink) checkAgainstMerkleTree(t *MerkleTriple) (found bool, err error) {
	found = false
	if t != nil && c.GetSeqno() == t.seqno {
		G.Log.Debug("| Found chain tail advertised in Merkle tree @%d", int(t.seqno))
		found = true
		if !c.id.Eq(t.linkId) {
			err = fmt.Errorf("Bad chain ID at seqno=%d", int(t.seqno))
		}
	}
	return
}

func (c *ChainLink) Unpack(trusted bool) (err error) {
	tmp := ChainLinkUnpacked{}

	c.packed.AtKey("payload_json").GetStringVoid(&tmp.payloadJsonStr, &err)
	c.packed.AtKey("sig").GetStringVoid(&tmp.sig, &err)
	GetSigIdVoid(c.packed.AtKey("sig_id"), true, &tmp.sigId, &err)

	if err != nil {
		return err
	}

	c.payloadJson, err = jsonw.Unmarshal([]byte(tmp.payloadJsonStr))
	if err != nil {
		return err
	}

	var uid_tmp string
	var sq int64

	GetPgpFingerprintVoid(c.payloadJson.AtPath("body.key.fingerprint"),
		&tmp.pgpFingerprint, &err)
	c.payloadJson.AtPath("body.key.username").GetStringVoid(&tmp.username, &err)
	c.payloadJson.AtPath("body.key.uid").GetStringVoid(&uid_tmp, &err)
	GetLinkIdVoid(c.payloadJson.AtKey("prev"), &tmp.prev, &err)
	c.payloadJson.AtKey("seqno").GetInt64Void(&sq, &err)
	c.payloadJson.AtKey("ctime").GetInt64Void(&tmp.ctime, &err)

	var ei int64
	c.payloadJson.AtKey("expire_in").GetInt64Void(&ei, &err)

	// IF we're loaded from *trusted* storage, like our local
	// DB, then we can skip verification later
	if trusted {
		b, e2 := c.packed.AtKey("sig_verified").GetBool()
		if e2 == nil && b {
			c.sigVerified = true
			G.Log.Debug("| Link is marked as 'sig_verified'")
		}
	}

	if err == nil {
		tmp.uid = UID(uid_tmp)
		tmp.seqno = Seqno(sq)
		tmp.etime = tmp.ctime + ei
		c.unpacked = &tmp
	}

	G.Log.Debug("| Unpacked Link %s", c.id.ToString())

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

func (c ChainLink) GetSeqno() Seqno {
	if c.unpacked != nil {
		return c.unpacked.seqno
	} else {
		return Seqno(-1)
	}
}

func (c *ChainLink) VerifySig(k PgpKeyBundle) (cached bool, err error) {
	cached = false

	if c.sigVerified {
		G.Log.Debug("Skipped verification (cached): %s", c.id.ToString())
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

func LoadLinkFromServer(parent *SigChain, jw *jsonw.Wrapper) (ret *ChainLink, err error) {
	var id LinkId
	GetLinkIdVoid(jw.AtKey("payload_hash"), &id, &err)
	if err != nil {
		return
	}
	ret = NewChainLink(parent, id, jw)
	if err = ret.Unpack(false); err != nil {
		ret = nil
	}
	return
}

func NewChainLink(parent *SigChain, id LinkId, jw *jsonw.Wrapper) *ChainLink {
	return &ChainLink{parent, id, false, false, false, false, jw, nil, nil}
}

func LoadLinkFromStorage(parent *SigChain, id LinkId) (*ChainLink, error) {
	jw, err := G.LocalDb.Get(DbKey{Typ: DB_LINK, Key: id.ToString()})
	var ret *ChainLink
	if err == nil {
		// May as well recheck onload (maybe revisit this)
		ret = NewChainLink(parent, id, jw)
		if err = ret.Unpack(true); err != nil {
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

func (c ChainLink) MatchFingerprint(fp PgpFingerprint) bool {
	return fp.Eq(c.unpacked.pgpFingerprint)
}

func (c *ChainLink) MatchFingerprintAndMark(fp PgpFingerprint) bool {
	ret := c.MatchFingerprint(fp)
	c.activeKey = ret
	return ret
}

func (c ChainLink) MatchUidAndUsername(uid UID, username string) bool {
	return uid == c.unpacked.uid && username == c.unpacked.username
}
