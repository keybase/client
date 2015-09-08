package libkb

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

const (
	LinkIDLen = 32
)

type LinkID []byte

func GetLinkID(w *jsonw.Wrapper) (LinkID, error) {
	if w.IsNil() {
		return nil, nil
	}
	s, err := w.GetString()
	if err != nil {
		return nil, err
	}
	ret, err := LinkIDFromHex(s)
	return ret, err
}

func GetLinkIDVoid(w *jsonw.Wrapper, l *LinkID, e *error) {
	ret, err := GetLinkID(w)
	if err != nil {
		*e = err
	} else {
		*l = ret
	}
}

func (l *LinkID) UnmarshalJSON(b []byte) error {
	lid, err := LinkIDFromHex(keybase1.Unquote(b))
	if err != nil {
		return err
	}
	copy((*l)[:], lid[:])
	return nil
}

func (l *LinkID) MarshalJSON() ([]byte, error) {
	return keybase1.Quote(l.String()), nil
}

func LinkIDFromHex(s string) (LinkID, error) {
	bv, err := hex.DecodeString(s)
	if err == nil && len(bv) != LinkIDLen {
		err = fmt.Errorf("Bad link ID; wrong length: %d", len(bv))
		bv = nil
	}
	var ret LinkID
	if bv != nil {
		ret = LinkID(bv)
	}
	return ret, err
}

func (l LinkID) String() string {
	return hex.EncodeToString(l)
}

func (l LinkID) Eq(i2 LinkID) bool {
	if l == nil && i2 == nil {
		return true
	} else if l == nil || i2 == nil {
		return false
	} else {
		return FastByteArrayEq(l[:], i2[:])
	}
}

type ChainLinkUnpacked struct {
	prev           LinkID
	seqno          Seqno
	payloadJSONStr string
	ctime, etime   int64
	pgpFingerprint *PGPFingerprint
	kid            keybase1.KID
	eldestKID      keybase1.KID
	sig            string
	sigID          keybase1.SigID
	uid            keybase1.UID
	username       string
	typ            string
	proofText      string
}

// A template for some of the reasons in badChainLinks below.
const badLinkTemplate = "Link %d of akalin's sigchain, which was accidentally added by an old client in development on 23 Mar 2015 20:02 GMT."

// A map from SigIDs of bad chain links that should be ignored to the
// reasons why they're ignored.
var badChainLinks = map[keybase1.SigID]string{
	// Links 22-25 of akalin's sigchain, which was accidentally
	// added by an old client in development on 3/23/2015, 9:02am.
	"2a0da9730f049133ce728ba30de8c91b6658b7a375e82c4b3528d7ddb1a21f7a0f": fmt.Sprintf(badLinkTemplate, 22),
	"eb5c7e7d3cf8370bed8ab55c0d8833ce9d74fd2c614cf2cd2d4c30feca4518fa0f": fmt.Sprintf(badLinkTemplate, 23),
	"0f175ef0d3b57a9991db5deb30f2432a85bc05922bbe727016f3fb660863a1890f": fmt.Sprintf(badLinkTemplate, 24),
	"48267f0e3484b2f97859829503e20c2f598529b42c1d840a8fc1eceda71458400f": fmt.Sprintf(badLinkTemplate, 25),
}

type ChainLink struct {
	parent          *SigChain
	id              LinkID
	hashVerified    bool
	sigVerified     bool
	payloadVerified bool
	chainVerified   bool
	storedLocally   bool
	revoked         bool
	unsigned        bool
	dirty           bool

	packed      *jsonw.Wrapper
	payloadJSON *jsonw.Wrapper
	unpacked    *ChainLinkUnpacked
	cki         *ComputedKeyInfos

	typed TypedChainLink
}

// Returns whether or not this chain link is bad, and if so, what the
// reason is.
func (c *ChainLink) IsBad() (isBad bool, reason string) {
	reason, isBad = badChainLinks[c.GetSigID()]
	return isBad, reason
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

func (c *ChainLink) GetPrev() LinkID {
	return c.unpacked.prev
}

func (c *ChainLink) GetCTime() time.Time {
	return time.Unix(int64(c.unpacked.ctime), 0)
}

func (c *ChainLink) GetETime() time.Time {
	return UnixToTimeMappingZero(c.unpacked.etime)
}

func (c *ChainLink) GetUID() keybase1.UID {
	return c.unpacked.uid
}

func (c *ChainLink) GetPayloadJSON() *jsonw.Wrapper {
	return c.payloadJSON
}

func (c *ChainLink) Pack() error {
	p := jsonw.NewDictionary()

	// Store the original JSON string so its order is preserved
	p.SetKey("payload_json", jsonw.NewString(c.unpacked.payloadJSONStr))
	p.SetKey("sig", jsonw.NewString(c.unpacked.sig))
	p.SetKey("sig_id", jsonw.NewString(string(c.unpacked.sigID)))
	p.SetKey("kid", c.unpacked.kid.ToJsonw())
	p.SetKey("ctime", jsonw.NewInt64(c.unpacked.ctime))
	if c.unpacked.pgpFingerprint != nil {
		p.SetKey("fingerprint", jsonw.NewString(c.unpacked.pgpFingerprint.String()))
	}
	p.SetKey("sig_verified", jsonw.NewBool(c.sigVerified))
	p.SetKey("proof_text_full", jsonw.NewString(c.unpacked.proofText))

	if c.cki != nil {
		p.SetKey("computed_key_infos", jsonw.NewWrapper(*c.cki))
	}

	c.packed = p

	return nil
}

func (c *ChainLink) GetMerkleSeqno() int {
	i, err := c.payloadJSON.AtPath("body.merkle_root.seqno").GetInt()
	if err != nil {
		i = 0
	}
	return i
}

func (c *ChainLink) GetRevocations() []keybase1.SigID {
	var ret []keybase1.SigID
	jw := c.payloadJSON.AtKey("body").AtKey("revoke")
	s, err := GetSigID(jw.AtKey("sig_id"), true)
	if err == nil {
		ret = append(ret, s)
	}
	v := jw.AtKey("sig_ids")
	var l int
	l, err = v.Len()
	if err == nil && l > 0 {
		for i := 0; i < l; i++ {
			if s, err = GetSigID(v.AtIndex(i), true); err == nil {
				ret = append(ret, s)
			}
		}
	}
	return ret
}

func (c *ChainLink) GetRevokeKids() []keybase1.KID {
	var ret []keybase1.KID
	jw := c.payloadJSON.AtKey("body").AtKey("revoke")
	if jw.IsNil() {
		return nil
	}
	s, err := GetKID(jw.AtKey("kid"))
	if err == nil {
		ret = append(ret, s)
	}
	v := jw.AtKey("kids")
	l, err := v.Len()
	if err != nil {
		return ret
	}
	for i := 0; i < l; i++ {
		s, err = GetKID(v.AtIndex(i))
		if err != nil {
			continue
		}
		ret = append(ret, s)
	}
	return ret
}

func (c *ChainLink) checkAgainstMerkleTree(t *MerkleTriple) (found bool, err error) {
	found = false
	if t != nil && c.GetSeqno() == t.Seqno {
		G.Log.Debug("| Found chain tail advertised in Merkle tree @%d", int(t.Seqno))
		found = true
		if !c.id.Eq(t.LinkID) {
			err = fmt.Errorf("Bad chain ID at seqno=%d", int(t.Seqno))
		}
	}
	return
}

func (c *ChainLink) UnpackPayloadJSON(tmp *ChainLinkUnpacked) (err error) {
	var sq int64
	var e2 error

	if jw := c.payloadJSON.AtPath("body.key.fingerprint"); !jw.IsNil() {
		if tmp.pgpFingerprint, e2 = GetPGPFingerprint(jw); e2 != nil {
			err = e2
		}
	}
	if jw := c.payloadJSON.AtPath("body.key.kid"); !jw.IsNil() {
		if tmp.kid, e2 = GetKID(jw); e2 != nil {
			err = e2
		}
	}
	if jw := c.payloadJSON.AtPath("body.key.eldest_kid"); !jw.IsNil() {
		if tmp.eldestKID, e2 = GetKID(jw); e2 != nil {
			err = e2
		}
	}
	c.payloadJSON.AtPath("body.key.username").GetStringVoid(&tmp.username, &err)
	GetUIDVoid(c.payloadJSON.AtPath("body.key.uid"), &tmp.uid, &err)
	GetLinkIDVoid(c.payloadJSON.AtKey("prev"), &tmp.prev, &err)
	c.payloadJSON.AtPath("body.type").GetStringVoid(&tmp.typ, &err)
	c.payloadJSON.AtKey("ctime").GetInt64Void(&tmp.ctime, &err)

	c.payloadJSON.AtKey("seqno").GetInt64Void(&sq, &err)

	var ei int64
	c.payloadJSON.AtKey("expire_in").GetInt64Void(&ei, &err)

	if err != nil {
		return
	}

	tmp.seqno = Seqno(sq)
	tmp.etime = tmp.ctime + ei

	return
}

func (c *ChainLink) UnpackLocal() (err error) {
	tmp := ChainLinkUnpacked{}
	err = c.UnpackPayloadJSON(&tmp)
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

func (c *ChainLink) Unpack(trusted bool, selfUID keybase1.UID) (err error) {
	tmp := ChainLinkUnpacked{}

	c.packed.AtKey("sig").GetStringVoid(&tmp.sig, &err)
	tmp.sigID, err = GetSigID(c.packed.AtKey("sig_id"), true)
	c.packed.AtKey("payload_json").GetStringVoid(&tmp.payloadJSONStr, &err)

	if err != nil {
		return err
	}

	c.payloadJSON, err = jsonw.Unmarshal([]byte(tmp.payloadJSONStr))
	if err != nil {
		return err
	}

	err = c.UnpackPayloadJSON(&tmp)
	if err != nil {
		return err
	}

	// Set the unpacked.kid member if it's not already set. If it is set, check
	// that the value is consistent with what's in the outer JSON blob.
	serverKID, err := GetKID(c.packed.AtKey("kid"))
	if err != nil {
		return err
	}
	if tmp.kid.IsNil() {
		tmp.kid = serverKID
	} else if tmp.kid != serverKID {
		return ChainLinkKIDMismatchError{
			fmt.Sprintf("Payload KID (%s) doesn't match server KID (%s).",
				tmp.kid, serverKID),
		}
	}

	// only unpack the proof_text_full if owner of this link
	if tmp.uid.Equal(selfUID) {
		ptf := c.packed.AtKey("proof_text_full")
		if !ptf.IsNil() {
			ptf.GetStringVoid(&tmp.proofText, &err)
		}
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
				G.Log.Warning("Problem unpacking computed key infos: %s\n", e3)
			}
		}
	}

	G.Log.Debug("| Unpacked Link %s", c.id)

	return err
}

func (c *ChainLink) CheckNameAndID(s NormalizedUsername, i keybase1.UID) error {
	if c.unpacked.uid.NotEqual(i) {
		return UIDMismatchError{
			fmt.Sprintf("UID mismatch %s != %s in Link %s", c.unpacked.uid, i, c.id),
		}
	}
	if !s.Eq(NewNormalizedUsername(c.unpacked.username)) {
		return BadUsernameError{
			fmt.Sprintf("Username mismatch %s != %s in Link %s",
				c.unpacked.username, s, c.id),
		}
	}
	return nil

}

func ComputeLinkID(d []byte) LinkID {
	h := sha256.Sum256(d)
	return LinkID(h[:])
}

func (c *ChainLink) VerifyHash() error {
	if c.hashVerified {
		return nil
	}

	h := sha256.Sum256([]byte(c.unpacked.payloadJSONStr))
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

	sigid, err := SigAssertPayload(c.unpacked.sig, []byte(c.unpacked.payloadJSONStr))
	if err != nil {
		return err
	}

	c.unpacked.sigID = sigid
	c.payloadVerified = true
	return nil
}

func (c *ChainLink) GetSeqno() Seqno {
	if c.unpacked != nil {
		return c.unpacked.seqno
	}
	return Seqno(-1)
}

func (c *ChainLink) GetSigID() keybase1.SigID {
	if c.unpacked == nil {
		return ""
	}
	return c.unpacked.sigID
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
	var sigID keybase1.SigID

	err = c.checkServerSignatureMetadata(ckf.kf)
	if err != nil {
		return cached, err
	}

	if key, _, err = ckf.FindActiveSibkeyAtTime(c.GetKID(), c.GetCTime()); err != nil {
		return
	}

	if err = c.VerifyLink(); err != nil {
		return
	}

	if sigID, err = key.VerifyString(c.unpacked.sig, []byte(c.unpacked.payloadJSONStr)); err != nil {
		return cached, BadSigError{err.Error()}
	}
	c.unpacked.sigID = sigID

	return
}

func (c *ChainLink) VerifySig(k PGPKeyBundle) (bool, error) {
	if c.sigVerified {
		G.Log.Debug("Skipped verification (cached): %s", c.id)
		return true, nil
	}

	if c.unpacked.pgpFingerprint == nil {
		return false, NoKeyError{}
	}

	if !k.GetFingerprint().Eq(*c.unpacked.pgpFingerprint) {
		return false, fmt.Errorf("Key fingerprint mismatch")
	}

	sigID, err := k.VerifyString(c.unpacked.sig, []byte(c.unpacked.payloadJSONStr))
	if err != nil {
		return false, err
	}

	c.unpacked.sigID = sigID
	c.sigVerified = true
	c.dirty = true
	return false, nil
}

func ImportLinkFromServer(parent *SigChain, jw *jsonw.Wrapper, selfUID keybase1.UID) (ret *ChainLink, err error) {
	var id LinkID
	GetLinkIDVoid(jw.AtKey("payload_hash"), &id, &err)
	if err != nil {
		return
	}
	ret = NewChainLink(parent, id, jw)
	if err = ret.Unpack(false, selfUID); err != nil {
		ret = nil
	}
	return
}

func NewChainLink(parent *SigChain, id LinkID, jw *jsonw.Wrapper) *ChainLink {
	return &ChainLink{
		parent: parent,
		id:     id,
		packed: jw,
	}
}

func ImportLinkFromStorage(id LinkID, selfUID keybase1.UID) (*ChainLink, error) {
	jw, err := G.LocalDb.Get(DbKey{Typ: DBLink, Key: id.String()})
	var ret *ChainLink
	if err == nil {
		// May as well recheck onload (maybe revisit this)
		ret = NewChainLink(nil, id, jw)
		if err = ret.Unpack(true, selfUID); err != nil {
			ret = nil
		}
		ret.storedLocally = true
	}
	return ret, err
}

func (c *ChainLink) VerifyLink() error {
	if err := c.VerifyHash(); err != nil {
		return err
	}
	if err := c.VerifyPayload(); err != nil {
		return err
	}
	return nil
}

func (c *ChainLink) checkServerSignatureMetadata(kf *KeyFamily) error {
	// Check the payload KID, fingerprint, and ctime against the
	// server-provided KID and ctime.
	serverKID, err := GetKID(c.packed.AtKey("kid"))
	if err != nil {
		return err
	}
	serverKey, err := kf.FindKeyWithKIDUnsafe(serverKID)
	if err != nil {
		return err
	}
	// Check the KID. This is actually redundant of a check we do in Unpack(),
	// but I'm keeping it here in case we change the way we unpack in the
	// future.  --jacko
	if c.unpacked.kid.Exists() && c.unpacked.kid.NotEqual(serverKID) {
		return ChainLinkKIDMismatchError{
			fmt.Sprintf("Payload KID (%s) doesn't match server KID (%s).",
				c.unpacked.kid, serverKID),
		}
	}
	// Check the fingerprint.
	if c.unpacked.pgpFingerprint != nil {
		payloadFingerprintStr := c.unpacked.pgpFingerprint.String()
		serverFingerprintStr := ""
		if serverKey.GetFingerprintP() != nil {
			serverFingerprintStr = serverKey.GetFingerprintP().String()
		}
		if payloadFingerprintStr != serverFingerprintStr {
			return ChainLinkFingerprintMismatchError{
				fmt.Sprintf("Payload fingerprint (%s) did not match server key (%s).",
					payloadFingerprintStr, serverFingerprintStr),
			}
		}
	}
	return nil
}

func (c *ChainLink) Store() (didStore bool, err error) {

	if c.storedLocally && !c.dirty {
		didStore = false
		return
	}

	if err = c.VerifyLink(); err != nil {
		return
	}

	if !c.hashVerified || !c.payloadVerified {
		err = fmt.Errorf("Internal error; should have been verified in Store()")
		return
	}

	if err = c.Pack(); err != nil {
		return
	}

	key := DbKey{Typ: DBLink, Key: c.id.String()}

	// Don't write with any aliases
	if err = G.LocalDb.Put(key, []DbKey{}, c.packed); err != nil {
		return
	}
	G.Log.Debug("| Store Link %s", c.id)

	c.storedLocally = true
	c.dirty = false
	didStore = true
	return
}

func (c *ChainLink) GetPGPFingerprint() *PGPFingerprint { return c.unpacked.pgpFingerprint }
func (c *ChainLink) GetKID() keybase1.KID               { return c.unpacked.kid }

func (c *ChainLink) MatchFingerprint(fp PGPFingerprint) bool {
	return c.unpacked.pgpFingerprint != nil && fp.Eq(*c.unpacked.pgpFingerprint)
}

func (c *ChainLink) ToEldestKID() keybase1.KID {
	if !c.unpacked.eldestKID.IsNil() {
		return c.unpacked.eldestKID
	}
	// For links that don't explicitly specify an eldest KID, it's implied
	// that we're starting a new subchain, so the signing KID is the
	// eldest.
	return c.GetKID()
}

// ToLinkSummary converts a ChainLink into a MerkleTriple object.
func (c ChainLink) ToMerkleTriple() *MerkleTriple {
	return &MerkleTriple{
		Seqno:  c.GetSeqno(),
		LinkID: c.id,
	}
}

//=========================================================================
// IsInCurrentFamily checks to see if the given chainlink
// was signed by a key in the current family.
func (c *ChainLink) IsInCurrentFamily(u *User) bool {
	eldest := u.GetEldestKID()
	if eldest.IsNil() {
		return false
	}
	return eldest.Equal(c.ToEldestKID())
}

//=========================================================================

func (c *ChainLink) Typed() TypedChainLink {
	return c.typed
}
