package libkb

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	jsonw "github.com/keybase/go-jsonw"
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

func (p LinkId) String() string {
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
	pgpFingerprint *PgpFingerprint
	kid            KID
	eldestKid      KID
	sig            string
	sigId          SigId
	uid            UID
	username       string
	typ            string
}

type ChainLink struct {
	parent          *SigChain
	id              LinkId
	hashVerified    bool
	sigVerified     bool
	payloadVerified bool
	chainVerified   bool
	storedLocally   bool
	revoked         bool
	unsigned        bool
	dirty           bool

	packed      *jsonw.Wrapper
	payloadJson *jsonw.Wrapper
	unpacked    *ChainLinkUnpacked
	lastChecked *CheckResult
	cki         *ComputedKeyInfos

	typed TypedChainLink
}

func (c *ChainLink) Parent() *SigChain {
	return c.parent
}

func (c *ChainLink) SetParent(parent *SigChain) {
	if c.parent != nil {
		G.Log.Warning("changing ChainLink parent")
	}
	c.parent = parent
}

func (c *ChainLink) GetPrev() LinkId {
	return c.unpacked.prev
}

func (c *ChainLink) GetCTime() time.Time {
	return time.Unix(int64(c.unpacked.ctime), 0)
}
func (c *ChainLink) GetETime() time.Time {
	return UnixToTimeMappingZero(c.unpacked.etime)
}

func (c *ChainLink) MarkChecked(err ProofError) {
	c.lastChecked = &CheckResult{
		Status: err,
		Time:   time.Now(),
	}
}

func (c *ChainLink) GetPayloadJson() *jsonw.Wrapper {
	return c.payloadJson
}

func (c *ChainLink) GetProofState0() int {
	if c.lastChecked == nil {
		return PROOF_STATE_NONE
	} else if c.lastChecked.Status == nil {
		return PROOF_STATE_OK
	} else {
		return PROOF_STATE_TEMP_FAILURE
	}
}

func (c *ChainLink) Pack() error {
	p := jsonw.NewDictionary()

	// Store the original JSON string so its order is preserved
	p.SetKey("payload_json", jsonw.NewString(c.unpacked.payloadJsonStr))
	p.SetKey("sig", jsonw.NewString(c.unpacked.sig))
	p.SetKey("sig_id", jsonw.NewString(c.unpacked.sigId.ToString(true)))
	if c.unpacked.pgpFingerprint != nil {
		p.SetKey("fingerprint", jsonw.NewString(c.unpacked.pgpFingerprint.String()))
	}
	p.SetKey("sig_verified", jsonw.NewBool(c.sigVerified))

	if c.cki != nil {
		p.SetKey("computed_key_infos", jsonw.NewWrapper(*c.cki))
	}

	c.packed = p

	return nil
}

func (c *ChainLink) GetMerkleSeqno() int {
	i, err := c.payloadJson.AtPath("body.merkle_root.seqno").GetInt()
	if err != nil {
		i = 0
	}
	return i
}

func (c *ChainLink) GetRevocations() []*SigId {
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
			if s, err = GetSigId(v.AtIndex(i), true); err == nil {
				ret = append(ret, s)
			}
		}
	}
	return ret
}

func (c *ChainLink) GetRevokeKids() []KID {
	ret := make([]KID, 0, 0)
	jw := c.payloadJson.AtKey("body").AtKey("revoke")
	if jw.IsNil() {
		return nil
	}
	s, err := GetKID(jw.AtKey("kid"))
	if err == nil {
		ret = append(ret, s)
	}
	v := jw.AtKey("kids")
	var l int
	l, err = v.Len()
	if err == nil && l > 0 {
		for i := 0; i < l; i++ {
			if s, err = GetKID(v.AtIndex(i)); err == nil {
				ret = append(ret, s)
			}
		}
	}
	return ret
}

func (c *ChainLink) checkAgainstMerkleTree(t *MerkleTriple) (found bool, err error) {
	found = false
	if t != nil && c.GetSeqno() == t.Seqno {
		G.Log.Debug("| Found chain tail advertised in Merkle tree @%d", int(t.Seqno))
		found = true
		if !c.id.Eq(t.LinkId) {
			err = fmt.Errorf("Bad chain ID at seqno=%d", int(t.Seqno))
		}
	}
	return
}

func (c *ChainLink) UnpackPayloadJson(tmp *ChainLinkUnpacked) (err error) {
	var sq int64
	var e2 error

	if jw := c.payloadJson.AtPath("body.key.fingerprint"); !jw.IsNil() {
		if tmp.pgpFingerprint, e2 = GetPgpFingerprint(jw); e2 != nil {
			err = e2
		}
	}
	if jw := c.payloadJson.AtPath("body.key.kid"); !jw.IsNil() {
		if tmp.kid, e2 = GetKID(jw); e2 != nil {
			err = e2
		}
	}
	if jw := c.payloadJson.AtPath("body.key.eldest_kid"); !jw.IsNil() {
		if tmp.eldestKid, e2 = GetKID(jw); e2 != nil {
			err = e2
		}
	}
	c.payloadJson.AtPath("body.key.username").GetStringVoid(&tmp.username, &err)
	GetUidVoid(c.payloadJson.AtPath("body.key.uid"), &tmp.uid, &err)
	GetLinkIdVoid(c.payloadJson.AtKey("prev"), &tmp.prev, &err)
	c.payloadJson.AtPath("body.type").GetStringVoid(&tmp.typ, &err)
	c.payloadJson.AtKey("ctime").GetInt64Void(&tmp.ctime, &err)

	c.payloadJson.AtKey("seqno").GetInt64Void(&sq, &err)

	var ei int64
	c.payloadJson.AtKey("expire_in").GetInt64Void(&ei, &err)

	if err != nil {
		return
	}

	tmp.seqno = Seqno(sq)
	tmp.etime = tmp.ctime + ei

	return
}

func (c *ChainLink) UnpackLocal() (err error) {
	tmp := ChainLinkUnpacked{}
	err = c.UnpackPayloadJson(&tmp)
	if err == nil {
		c.unpacked = &tmp
	}
	return
}

func (c *ChainLink) UnpackComputedKeyInfos(jw *jsonw.Wrapper) (err error) {
	var tmp ComputedKeyInfos
	if jw == nil || jw.IsNil() {
		return
	}
	if err = jw.UnmarshalAgain(&tmp); err == nil {
		c.cki = &tmp
	}
	return
}

func (c *ChainLink) Unpack(trusted bool) (err error) {
	tmp := ChainLinkUnpacked{}

	c.packed.AtKey("sig").GetStringVoid(&tmp.sig, &err)
	GetSigIdVoid(c.packed.AtKey("sig_id"), true, &tmp.sigId, &err)
	c.packed.AtKey("payload_json").GetStringVoid(&tmp.payloadJsonStr, &err)

	if err != nil {
		return err
	}

	c.payloadJson, err = jsonw.Unmarshal([]byte(tmp.payloadJsonStr))
	if err != nil {
		return err
	}

	err = c.UnpackPayloadJson(&tmp)
	if err != nil {
		return err
	}

	c.unpacked = &tmp

	// IF we're loaded from *trusted* storage, like our local
	// DB, then we can skip verification later
	if trusted {
		b, e2 := c.packed.AtKey("sig_verified").GetBool()
		if e2 == nil && b {
			c.sigVerified = true
			G.Log.Debug("| Link is marked as 'sig_verified'")
			if e3 := c.UnpackComputedKeyInfos(c.packed.AtKey("computed_key_infos")); e3 != nil {
				G.Log.Warning("Problem unpacking computed key infos: %s\n", e3.Error())
			}
		}
	}

	G.Log.Debug("| Unpacked Link %s", c.id)

	return err
}

func (c *ChainLink) CheckNameAndId(s string, i UID) error {
	if !c.unpacked.uid.Eq(i) {
		return fmt.Errorf("UID mismatch %s != %s in Link %s",
			c.unpacked.uid.String(), i.String(), c.id.String())
	}
	if !Cicmp(c.unpacked.username, s) {
		return fmt.Errorf("Username mismatch %s != %s in Link %s",
			c.unpacked.username, s, c.id.String())
	}
	return nil

}

func ComputeLinkId(d []byte) LinkId {
	h := sha256.Sum256(d)
	return LinkId(h[:])
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

func (c *ChainLink) VerifyPayload() error {
	if c.payloadVerified {
		return nil
	}

	sigid, err := SigAssertPayload(c.unpacked.sig, []byte(c.unpacked.payloadJsonStr))
	if err != nil {
		return err
	}

	c.unpacked.sigId = *sigid
	c.payloadVerified = true
	return nil
}

func (c *ChainLink) GetSeqno() Seqno {
	if c.unpacked != nil {
		return c.unpacked.seqno
	}
	return Seqno(-1)
}

func (c *ChainLink) GetSigId() *SigId {
	if c.unpacked != nil {
		return &c.unpacked.sigId
	}
	return nil
}

func (c *ChainLink) GetSigCheckCache() (cki *ComputedKeyInfos) {
	if c.sigVerified && c.cki != nil {
		cki = c.cki
	}
	return
}

func (c *ChainLink) PutSigCheckCache(cki *ComputedKeyInfos) {
	G.Log.Debug("Caching SigCheck for link %s:", c.id)
	c.sigVerified = true
	c.dirty = true
	c.cki = cki
	return
}

func (c *ChainLink) VerifySigWithKeyFamily(ckf ComputedKeyFamily) (cached bool, err error) {

	var key GenericKey
	var sigId *SigId

	if key, _, err = ckf.FindActiveSibkeyAtTime(c.ToFOKID(), c.GetCTime()); err != nil {
		return
	}

	if err = c.VerifyLink(); err != nil {
		return
	}

	if sigId, err = key.Verify(c.unpacked.sig, []byte(c.unpacked.payloadJsonStr)); err != nil {
		return
	}
	c.unpacked.sigId = *sigId

	return
}

func (c *ChainLink) VerifySig(k PgpKeyBundle) (cached bool, err error) {
	cached = false

	if c.sigVerified {
		G.Log.Debug("Skipped verification (cached): %s", c.id)
		cached = true
		return
	}

	if c.unpacked.pgpFingerprint == nil {
		err = NoKeyError{}
		return
	}

	if !k.GetFingerprint().Eq(*c.unpacked.pgpFingerprint) {
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
	c.dirty = true
	return
}

func ImportLinkFromServer(parent *SigChain, jw *jsonw.Wrapper) (ret *ChainLink, err error) {
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
	return &ChainLink{
		parent: parent,
		id:     id,
		packed: jw,
	}
}

func ImportLinkFromStorage(id LinkId) (*ChainLink, error) {
	jw, err := G.LocalDb.Get(DbKey{Typ: DB_LINK, Key: id.String()})
	var ret *ChainLink
	if err == nil {
		// May as well recheck onload (maybe revisit this)
		ret = NewChainLink(nil, id, jw)
		if err = ret.Unpack(true); err != nil {
			ret = nil
		}
		ret.storedLocally = true
	}
	return ret, err
}

func (l *ChainLink) VerifyLink() error {
	if err := l.VerifyHash(); err != nil {
		return err
	}
	if err := l.VerifyPayload(); err != nil {
		return err
	}
	return nil
}

func (l *ChainLink) Store() (didStore bool, err error) {

	if l.storedLocally && !l.dirty {
		didStore = false
		return
	}

	if err = l.VerifyLink(); err != nil {
		return
	}

	if !l.hashVerified || !l.payloadVerified {
		err = fmt.Errorf("Internal error; should have been verified in Store()")
		return
	}

	if err = l.Pack(); err != nil {
		return
	}

	key := DbKey{Typ: DB_LINK, Key: l.id.String()}

	// Don't write with any aliases
	if err = G.LocalDb.Put(key, []DbKey{}, l.packed); err != nil {
		return
	}
	G.Log.Debug("| Store Link %s", l.id)

	l.storedLocally = true
	l.dirty = false
	didStore = true
	return
}

// ToFOKID takes the current chain link and extracts the current (signing)
// FOKID
func (c *ChainLink) ToFOKID() (ret FOKID) {
	ret = FOKID{
		Fp:  c.unpacked.pgpFingerprint,
		Kid: c.unpacked.kid,
	}
	return
}

// ToEldestFOKID takes the current chain link and extracts the eldest
// FOKID from it. Legacy links don't specify it, so we'll have to infer
func (c *ChainLink) ToEldestFOKID() (ret FOKID) {
	if c.unpacked.eldestKid != nil {
		ret = FOKID{Kid: c.unpacked.eldestKid}
	} else {
		ret = c.ToFOKID()
	}
	return
}

// MatchFOKID checks if the given ChainLink matches the given
// FOKID using standard FOKID equality.
func (c *ChainLink) MatchEldestFOKID(fokid FOKID) bool {
	return c.ToEldestFOKID().Eq(fokid)
}

func (c *ChainLink) GetPgpFingerprint() *PgpFingerprint { return c.unpacked.pgpFingerprint }
func (c *ChainLink) GetKid() KID                        { return c.unpacked.kid }

func (c *ChainLink) GetFOKID() FOKID {
	return FOKID{Kid: c.GetKid(), Fp: c.GetPgpFingerprint()}
}

func (c *ChainLink) MatchFingerprint(fp PgpFingerprint) bool {
	return c.unpacked.pgpFingerprint != nil && fp.Eq(*c.unpacked.pgpFingerprint)
}

func (c *ChainLink) MatchUidAndUsername(uid UID, username string) bool {
	return uid == c.unpacked.uid && username == c.unpacked.username
}

type LinkSummary struct {
	id    LinkId
	seqno Seqno
}

func (mt MerkleTriple) ToLinkSummary() (ret LinkSummary) {
	ret.id = mt.LinkId
	ret.seqno = mt.Seqno
	return
}

func (ls LinkSummary) Less(ls2 LinkSummary) bool {
	return ls.seqno < ls2.seqno
}

func (l LinkSummary) ToJson() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("id", jsonw.NewString(l.id.String()))
	ret.SetKey("seqno", jsonw.NewInt(int(l.seqno)))
	return ret
}

func GetLinkSummary(j *jsonw.Wrapper) (ret *LinkSummary, err error) {
	var seqno int
	var id LinkId
	j.AtKey("seqno").GetIntVoid(&seqno, &err)
	GetLinkIdVoid(j.AtKey("id"), &id, &err)
	if err == nil {
		ret = &LinkSummary{id, Seqno(seqno)}
	}
	return
}

func (l *ChainLink) ToLinkSummary() *LinkSummary {
	return &LinkSummary{
		id:    l.id,
		seqno: l.GetSeqno(),
	}
}

func (l *ChainLink) ToMerkleTriple() (ret MerkleTriple) {
	return MerkleTriple{
		LinkId: l.id,
		Seqno:  l.GetSeqno(),
		SigId:  l.GetSigId(),
	}
}

func (mt MerkleTriple) Less(ls LinkSummary) bool {
	return mt.Seqno < ls.seqno
}

//=========================================================================
// IsInCurrentFamily checks to see if the given chainlink
// was signed by a key in the current family.
func (c *ChainLink) IsInCurrentFamily(u *User) bool {
	fokid := u.GetEldestFOKID()
	if fokid == nil {
		return false
	}
	return c.MatchEldestFOKID(*fokid)
}

//=========================================================================
