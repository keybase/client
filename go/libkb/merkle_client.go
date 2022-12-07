// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/sha256"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	chat1 "github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/sig3"
	jsonw "github.com/keybase/go-jsonw"
)

const (
	NodeHashLenLong  = sha512.Size // = 64
	NodeHashLenShort = sha256.Size // = 32
)

type NodeHash interface {
	Check(s string) bool // Check if the node hashes to this string
	String() string
	bytes() []byte
	IsNil() bool
	Eq(h NodeHash) bool
}

type NodeHashShort [NodeHashLenShort]byte
type NodeHashLong [NodeHashLenLong]byte

// NodeHashAny incorporates either a short (256-bit) or a long (512-bit) hash.
// It's unfortunate we need it, but I didn't see any other way to use the
// Go json marshal/unmarshal system where the hashes might be either short
// or long. Our hacky solution is to have a union-type struct that supports
// both, and just to unmarshal into the relevant field. Note this
// type also fits ths NodeHash interface.
type NodeHashAny struct {
	s *NodeHashShort
	l *NodeHashLong
}

var _ NodeHash = NodeHashShort{}
var _ NodeHash = NodeHashLong{}
var _ NodeHash = NodeHashAny{}

func (h1 NodeHashShort) Check(s string) bool {
	h2 := sha256.Sum256([]byte(s))
	return subtle.ConstantTimeCompare(h1[:], h2[:]) == 1
}

func (h1 NodeHashShort) String() string {
	return hex.EncodeToString(h1[:])
}

func (h1 NodeHashShort) bytes() []byte {
	return h1[:]
}

func (h1 NodeHashShort) IsNil() bool {
	return false
}

func (h1 NodeHashShort) Eq(h2 NodeHash) bool {
	return subtle.ConstantTimeCompare(h1.bytes(), h2.bytes()) == 1
}

func (h1 NodeHashShort) ExportToHashMeta() keybase1.HashMeta {
	return keybase1.HashMeta(h1.bytes())
}

func (h1 NodeHashLong) Check(s string) bool {
	h2 := sha512.Sum512([]byte(s))
	return subtle.ConstantTimeCompare(h1[:], h2[:]) == 1
}

func (h1 NodeHashLong) String() string {
	return hex.EncodeToString(h1[:])
}

func (h1 NodeHashLong) bytes() []byte {
	return h1[:]
}

func (h1 NodeHashLong) IsNil() bool {
	return false
}

func (h1 NodeHashLong) Eq(h2 NodeHash) bool {
	return subtle.ConstantTimeCompare(h1.bytes(), h2.bytes()) == 1
}

func hashEq(h1 NodeHash, h2 NodeHash) bool {
	b1 := h1.bytes()
	b2 := h2.bytes()
	return subtle.ConstantTimeCompare(b1, b2) == 1
}

func (h NodeHashAny) Check(s string) bool {
	switch {
	case h.s != nil:
		return h.s.Check(s)
	case h.l != nil:
		return h.l.Check(s)
	default:
		return false
	}
}

func (h NodeHashAny) String() string {
	switch {
	case h.s != nil:
		return h.s.String()
	case h.l != nil:
		return h.l.String()
	default:
		return ""
	}
}

func (h NodeHashAny) bytes() []byte {
	switch {
	case h.s != nil:
		return h.s.bytes()
	case h.l != nil:
		return h.l.bytes()
	default:
		return nil
	}
}

func (h NodeHashAny) Eq(h2 NodeHash) bool {
	return subtle.ConstantTimeCompare(h.bytes(), h2.bytes()) == 1
}

func (h *NodeHashAny) UnmarshalJSON(b []byte) error {
	s := keybase1.Unquote(b)

	// empty strings are OK, to mean no hash available
	if len(s) == 0 {
		return nil
	}

	g, err := NodeHashFromHex(s)
	if err != nil {
		return err
	}
	switch g := g.(type) {
	case NodeHashShort:
		h.s = &g
	case NodeHashLong:
		h.l = &g
	default:
		return errors.New("unknown hash type")
	}
	return nil
}

func (h NodeHashAny) IsNil() bool {
	return h.s == nil && h.l == nil
}

func (h1 *NodeHashShort) UnmarshalJSON(b []byte) error {
	s := keybase1.Unquote(b)
	// empty strings are OK, to mean no hash available
	if len(s) == 0 {
		return nil
	}
	g, err := NodeHashFromHex(s)
	if err != nil {
		return err
	}
	if ret, ok := g.(NodeHashShort); ok {
		*h1 = ret
		return nil
	}
	return errors.New("bad SHA256 hash")
}

func (h1 *NodeHashLong) UnmarshalJSON(b []byte) error {
	s := keybase1.Unquote(b)
	// empty strings are OK, to mean no hash available
	if len(s) == 0 {
		return nil
	}
	g, err := NodeHashFromHex(s)
	if err != nil {
		return err
	}
	if ret, ok := g.(NodeHashLong); ok {
		*h1 = ret
		return nil
	}
	return errors.New("bad SHA512hash")
}

func (h *NodeHashAny) MarshalJSON() ([]byte, error) {
	s := h.String()
	if len(s) == 0 {
		return nil, nil
	}
	return keybase1.Quote(s), nil
}

type MerkleClientInterface interface {
	CanExamineHistoricalRoot(m MetaContext, q keybase1.Seqno) bool
	FetchRootFromServerByMinSeqno(m MetaContext, lowerBound keybase1.Seqno) (mr *MerkleRoot, err error)
	FetchRootFromServer(m MetaContext, freshness time.Duration) (mr *MerkleRoot, err error)
	FirstExaminableHistoricalRoot(m MetaContext) *keybase1.Seqno
	FirstMainRootWithHiddenRootHash(m MetaContext) (s keybase1.Seqno, err error)
	LastRoot(m MetaContext) *MerkleRoot
	LastRootToSigJSON(m MetaContext) (ret *jsonw.Wrapper, err error)
	LookupLeafAtHashMeta(m MetaContext, leafID keybase1.UserOrTeamID, hm keybase1.HashMeta) (leaf *MerkleGenericLeaf, err error)
	LookupLeafAtSeqno(m MetaContext, leafID keybase1.UserOrTeamID, s keybase1.Seqno) (leaf *MerkleGenericLeaf, root *MerkleRoot, err error)
	LookupLeafAtSeqnoForAudit(m MetaContext, leafID keybase1.UserOrTeamID, s keybase1.Seqno, processHiddenRespFunc ProcessHiddenRespFunc) (leaf *MerkleGenericLeaf, root *MerkleRoot, hiddenResp *MerkleHiddenResponse, err error)
	LookupRootAtSeqno(m MetaContext, s keybase1.Seqno) (root *MerkleRoot, err error)
	LookupTeam(m MetaContext, teamID keybase1.TeamID) (leaf *MerkleTeamLeaf, err error)
	LookupTeamWithHidden(m MetaContext, teamID keybase1.TeamID, processHiddenRespFunc ProcessHiddenRespFunc) (leaf *MerkleTeamLeaf, hiddenResp *MerkleHiddenResponse, lastMerkleRoot *MerkleRoot, err error)
	LookupUser(m MetaContext, q HTTPArgs, sigHints *SigHints, opts MerkleOpts) (u *MerkleUserLeaf, err error)
}

type MerkleClient struct {
	Contextified

	// protects whole object
	//
	// Warning: Never grab the latestRootLock while holding this lock, as the
	// opposite happens and so you might introduce deadlocks.
	sync.RWMutex

	keyring *SpecialKeyRing

	// The most recently-available root
	lastRoot *MerkleRoot

	// The first node we saw that has skip pointers; not used in production
	firstSkip *keybase1.Seqno

	// The first merkle root that contains the root of the hidden merkle tree
	firstRootWithHidden keybase1.Seqno

	// latestRootLock ensures that only one API call to fetch the latest merkle
	// root is in flight at a time. These calls are expensive and would almost
	// always get the same answer when concurrent.
	//
	// Warning: it is ok, to grab the object Lock while holding this one, but do
	// not ever go the other way around, or you are risking deadlocks.
	latestRootLock sync.Mutex
}

var _ MerkleClientInterface = (*MerkleClient)(nil)

type MerkleRoot struct {
	sigs    *jsonw.Wrapper
	payload MerkleRootPayload
	fetched time.Time
}

func (mr MerkleRoot) HashMeta() keybase1.HashMeta {
	return mr.ShortHash().ExportToHashMeta()
}

func (mr MerkleRoot) IsNil() bool {
	return mr == MerkleRoot{}
}

type SkipSequence []MerkleRootPayload

type MerkleTriple struct {
	Seqno  keybase1.Seqno     `json:"seqno"`
	LinkID LinkID             `json:"id"`
	SigID  keybase1.SigIDBase `json:"sigid,omitempty"`
}

type MerkleUserLeaf struct {
	public    *MerkleTriple
	private   *MerkleTriple
	idVersion int64
	username  string
	uid       keybase1.UID
	eldest    keybase1.KID // may be empty
	resets    *MerkleResets
}

type MerkleTeamLeaf struct {
	TeamID  keybase1.TeamID
	Public  *MerkleTriple
	Private *MerkleTriple
}

type MerkleGenericLeaf struct {
	LeafID  keybase1.UserOrTeamID
	Public  *MerkleTriple
	Private *MerkleTriple

	// if the leaf is a User leaf, we'll have extra information here, like
	// reset chain and eldest key. On a team leaf, this will be nil.
	userExtras *MerkleUserLeaf
}

func (l MerkleTeamLeaf) MerkleGenericLeaf() *MerkleGenericLeaf {
	return &MerkleGenericLeaf{
		LeafID:  l.TeamID.AsUserOrTeam(),
		Public:  l.Public,
		Private: l.Private,
	}
}

func (mul MerkleUserLeaf) MerkleGenericLeaf() *MerkleGenericLeaf {
	return &MerkleGenericLeaf{
		LeafID:     mul.uid.AsUserOrTeam(),
		Public:     mul.public,
		Private:    mul.private,
		userExtras: &mul,
	}
}

func (l MerkleGenericLeaf) PartialClone() MerkleGenericLeaf {
	ret := MerkleGenericLeaf{LeafID: l.LeafID}
	if l.Public != nil {
		tmp := *l.Public
		ret.Public = &tmp
	}
	if l.Private != nil {
		tmp := *l.Private
		ret.Private = &tmp
	}
	return ret
}

type PathSteps []*PathStep

type merkleUserInfoT struct {
	uid                  keybase1.UID
	uidPath              PathSteps
	idVersion            int64
	username             string
	usernameCased        string
	unverifiedResetChain unverifiedResetChain
}

type VerificationPath struct {
	Contextified
	root *MerkleRoot
	path PathSteps
}

type MerkleRootPayload struct {
	packed   string
	unpacked *MerkleRootPayloadUnpacked
}

func (mrp MerkleRootPayload) shortHash() NodeHashShort {
	return sha256.Sum256([]byte(mrp.packed))
}

func (mrp MerkleRootPayload) hasSkips() bool {
	return len(mrp.unpacked.Body.Skips) > 0
}

type MerkleRootPayloadUnpacked struct {
	Body struct {
		Kbfs struct {
			Private struct {
				Root    keybase1.KBFSRootHash `json:"root"`
				Version *keybase1.Seqno       `json:"version"`
			} `json:"private"`
			Public struct {
				Root    keybase1.KBFSRootHash `json:"root"`
				Version *keybase1.Seqno       `json:"version"`
			} `json:"public"`
			PrivateTeam struct {
				Root    keybase1.KBFSRootHash `json:"root"`
				Version *keybase1.Seqno       `json:"version"`
			} `json:"privateteam"`
		} `json:"kbfs"`
		LegacyUIDRoot       NodeHashShort  `json:"legacy_uid_root"`
		Prev                NodeHashLong   `json:"prev"`
		Root                NodeHashLong   `json:"root"`
		Seqno               keybase1.Seqno `json:"seqno"`
		Skips               SkipTable      `json:"skips"`
		Txid                string         `json:"txid"`
		Type                string         `json:"type"`
		Version             int            `json:"version"`
		PvlHash             string         `json:"pvl_hash"`
		ProofServicesHash   string         `json:"proof_services_hash"`
		ExternalURLHash     string         `json:"external_urls_hash"`
		BlindMerkleRootHash string         `json:"blind_merkle_root_hash"`
	} `json:"body"`
	Ctime int64  `json:"ctime"`
	Tag   string `json:"tag"`
}

type SkipTable map[keybase1.Seqno]NodeHashAny

type PathStep struct {
	prefix string
	node   string // The JSON-stringified version of the node (to be unpacked lazily)
}

func (mt MerkleTriple) Eq(mt2 MerkleTriple) bool {
	return mt.Seqno == mt2.Seqno && mt.LinkID.Eq(mt2.LinkID) && mt.SigID.Eq(mt2.SigID)
}

func (mul MerkleUserLeaf) Public() *MerkleTriple {
	return mul.public
}

func NodeHashFromHex(s string) (NodeHash, error) {
	switch hex.DecodedLen(len(s)) {
	case NodeHashLenLong:
		var buf NodeHashLong
		err := DecodeHexFixed(buf[:], []byte(s))
		if err != nil {
			return nil, err
		}
		return buf, err
	case NodeHashLenShort:
		var buf NodeHashShort
		err := DecodeHexFixed(buf[:], []byte(s))
		if err != nil {
			return nil, err
		}
		return buf, err
	default:
		return nil, fmt.Errorf("Bad NodeHash; wrong length: %d", len(s))
	}
}

func GetNodeHash(w *jsonw.Wrapper) (NodeHash, error) {
	s, err := w.GetString()
	if err != nil {
		return nil, err
	}
	ret, err := NodeHashFromHex(s)
	return ret, err
}

func GetNodeHashVoid(w *jsonw.Wrapper, nhp *NodeHash, errp *error) {
	nh, err := GetNodeHash(w)
	if err != nil {
		*errp = err
	} else {
		*nhp = nh
	}
}

func computeSetBitsBigEndian(x uint) []uint {
	if x == 0 {
		return nil
	} else if x == 1 {
		return []uint{1}
	}
	// Allocate maximum array size necessary
	high := int(math.Ceil(math.Log2(float64(x))))
	ret := make([]uint, 0, high)
	for i, bit := 0, uint(1); i <= high; i, bit = i+1, bit*2 {
		if x&bit != 0 {
			ret = append(ret, bit)
		}
	}
	return ret
}

func computeLogPatternMerkleSkips(startSeqno keybase1.Seqno, endSeqno keybase1.Seqno) (ret []uint, err error) {
	if endSeqno < startSeqno {
		return ret, fmt.Errorf("got startSeqno > endSeqno (%d > %d) in merkle skip sequence", startSeqno, endSeqno)
	}
	if endSeqno == startSeqno {
		return ret, nil
	}
	end := uint(endSeqno)
	start := uint(startSeqno)
	diff := end - start
	skips := computeSetBitsBigEndian(diff)
	curr := end
	// Ignore first set bit
	for i := len(skips) - 1; i > 0; i-- {
		curr -= skips[i]
		ret = append(ret, curr)
	}
	return ret, nil
}

func NewMerkleClient(g *GlobalContext) *MerkleClient {
	return &MerkleClient{
		keyring:      NewSpecialKeyRing(g.Env.GetMerkleKIDs(), g),
		lastRoot:     nil,
		Contextified: NewContextified(g),
	}
}

func (mc *MerkleClient) init(m MetaContext) error {
	err := mc.loadRoot(m)
	return err
}

func merkleHeadKey() DbKey {
	// DBMerkleRoot was once used to store specific roots with Key: fmt.Sprintf("%d", int)
	return DbKey{
		Typ: DBMerkleRoot,
		Key: "HEAD",
	}
}

func (mc *MerkleClient) dbGet(m MetaContext, k DbKey) (ret *MerkleRoot, err error) {
	defer m.VTrace(VLog1, fmt.Sprintf("MerkleClient#dbGet(%+v)", k), &err)()
	curr, err := m.G().LocalDb.Get(k)
	if err != nil {
		return nil, err
	}
	if curr == nil {
		m.VLogf(VLog1, "| MerkleClient#dbGet(%+v) found not results", k)
		return nil, nil
	}

	mr, err := NewMerkleRootFromJSON(curr, MerkleOpts{})
	if err != nil {
		return nil, err
	}
	return mr, err
}

func (mc *MerkleClient) loadRoot(m MetaContext) (err error) {
	defer m.VTrace(VLog1, "MerkleClient#loadRoot()", &err)()
	var mr *MerkleRoot
	mr, err = mc.dbGet(m, merkleHeadKey())
	if mr == nil || err != nil {
		return err
	}
	mc.Lock()
	mc.lastRoot = mr
	mc.Unlock()
	return nil
}

func (mr *MerkleRoot) HasSkips() bool {
	return mr.payload.hasSkips()
}

func (mr *MerkleRoot) ToJSON() (jw *jsonw.Wrapper) {
	ret := jsonw.NewDictionary()
	_ = ret.SetKey("sigs", mr.sigs)
	_ = ret.SetKey("payload_json", jsonw.NewString(mr.payload.packed))
	_ = ret.SetKey("fetched_ns", jsonw.NewInt64(mr.fetched.UnixNano()))
	return ret
}

func (mr MerkleRoot) ShortHash() NodeHashShort {
	return mr.payload.shortHash()
}

func NewMerkleRootPayloadFromJSONString(s string) (ret MerkleRootPayload, err error) {
	ret = MerkleRootPayload{packed: s}
	err = json.Unmarshal([]byte(s), &ret.unpacked)
	if err != nil {
		return ret, err
	}
	return ret, nil
}

func NewMerkleRootFromJSON(jw *jsonw.Wrapper, opts MerkleOpts) (ret *MerkleRoot, err error) {
	var sigs *jsonw.Wrapper
	var payloadJSONString string
	var mrp MerkleRootPayload

	if !opts.noSigCheck {
		if sigs, err = jw.AtKey("sigs").ToDictionary(); err != nil {
			return nil, err
		}
	}

	if payloadJSONString, err = jw.AtKey("payload_json").GetString(); err != nil {
		return nil, err
	}

	if mrp, err = NewMerkleRootPayloadFromJSONString(payloadJSONString); err != nil {
		return nil, err
	}

	ret = &MerkleRoot{
		sigs:    sigs,
		payload: mrp,
		fetched: time.Time{},
	}

	fetchedNs, err := jw.AtKey("fetched_ns").GetInt64()
	if err == nil {
		ret.fetched = time.Unix(0, fetchedNs)
	}

	return ret, nil
}

func importPathFromJSON(jw *jsonw.Wrapper) (out []*PathStep, err error) {
	if jw.IsNil() {
		return
	}

	var path *jsonw.Wrapper
	if path, err = jw.ToArray(); err != nil {
		return
	}

	var l int
	if l, err = path.Len(); err != nil {
		return
	}

	for i := 0; i < l; i++ {
		var step *PathStep
		if step, err = pathStepFromJSON(path.AtIndex(i)); err != nil {
			return
		}
		out = append(out, step)
	}
	return
}

// FetchRootFromServerByMinSeqno returns the latest root this client knows
// about. If the seqno of the latest root is smaller than the lowerBound
// argument, a new api call is made to the server. However, if the server
// returns a root at a seqno smaller than lowerBound, no errors are raised.
func (mc *MerkleClient) FetchRootFromServerByMinSeqno(m MetaContext, lowerBound keybase1.Seqno) (mr *MerkleRoot, err error) {
	defer m.VTrace(VLog0, "MerkleClient#FetchRootFromServerByMinSeqno", &err)()

	checkFreshness := func() (ok bool, root *MerkleRoot) {
		root = mc.LastRoot(m)
		if root != nil && *root.Seqno() >= lowerBound {
			m.VLogf(VLog0, "seqno=%d, and was current enough, so returning non-nil previously fetched root", *root.Seqno())
			return true, root
		}
		return false, root
	}

	if ok, root := checkFreshness(); ok {
		return root, nil
	}

	mc.latestRootLock.Lock()
	defer mc.latestRootLock.Unlock()
	// by the time we got the lock, the root might have been updated to a recent enough one, so check again
	ok, root := checkFreshness()
	if ok {
		return root, nil
	}

	return mc.fetchAndStoreRootFromServerLocked(m, root)
}

// FetchRootFromServer fetches a root from the server. If the last-fetched root was fetched within
// freshness ago, then OK to return the last-fetched root. Otherwise refetch. Similarly, if the freshness
// passed is 0, then always refresh.
func (mc *MerkleClient) FetchRootFromServer(m MetaContext, freshness time.Duration) (mr *MerkleRoot, err error) {
	defer m.VTrace(VLog0, "MerkleClient#FetchRootFromServer", &err)()

	now := m.G().Clock().Now()

	checkFreshness := func() (ok bool, root *MerkleRoot) {
		root = mc.LastRoot(m)
		if root != nil && freshness > 0 && now.Sub(root.fetched) < freshness {
			m.VLogf(VLog0, "freshness=%s, and was current enough, so returning non-nil previously fetched root", freshness)
			return true, root
		}
		return false, root
	}

	if ok, root := checkFreshness(); ok {
		return root, nil
	}

	mc.latestRootLock.Lock()
	defer mc.latestRootLock.Unlock()
	// by the time we got the lock, the root might have been updated to a recent enough one, so check again
	ok, root := checkFreshness()
	if ok {
		return root, nil
	}

	return mc.fetchAndStoreRootFromServerLocked(m, root)
}

func (mc *MerkleClient) fetchAndStoreRootFromServerLocked(m MetaContext, lastRoot *MerkleRoot) (mr *MerkleRoot, err error) {
	defer m.VTrace(VLog0, "MerkleClient#fetchRootFromServerLocked", &err)()
	var ss SkipSequence
	var apiRes *APIRes
	var opts MerkleOpts

	mr, ss, apiRes, err = mc.lookupRootAndSkipSequence(m, lastRoot, opts)
	if err != nil {
		return nil, err
	}

	if mr == nil {
		// The server indicated that last root is the most recent one: updating
		// the fetch time and skipping verification
		lastRoot.fetched = m.G().Clock().Now()
		mc.Lock()
		defer mc.Unlock()
		mc.storeRoot(m, lastRoot)
		return lastRoot, nil
	}

	if err = mc.verifySkipSequenceAndRoot(m, ss, mr, lastRoot, apiRes, opts); err != nil {
		return nil, err
	}

	mc.Lock()
	defer mc.Unlock()
	mc.storeRoot(m, mr)

	return mr, nil
}

// if both mr and err are nil, this indicates the server did not send a new root
// as lastRoot was the most recent one.
func (mc *MerkleClient) lookupRootAndSkipSequence(m MetaContext, lastRoot *MerkleRoot, opts MerkleOpts) (mr *MerkleRoot, ss SkipSequence, apiRes *APIRes, err error) {

	// c=1 invokes server-side compression
	q := HTTPArgs{
		"c": B{true},
	}

	// Get back a series of skips from the last merkle root we had to the new
	// one we're getting back, and hold the server to it.
	lastSeqno := lastRoot.Seqno()
	if lastSeqno != nil {
		q.Add("last", I{int(*lastSeqno)})
		// If the last root known to the server has seqno last, we do not need
		// to receive it again.
		q.Add("skip_last", B{true})
	}

	apiRes, err = m.G().API.Get(m, APIArg{
		Endpoint:       "merkle/root",
		SessionType:    APISessionTypeNONE,
		Args:           q,
		AppStatusCodes: []int{SCOk},
	})

	if err != nil {
		return nil, nil, nil, err
	}

	seqno, err := apiRes.Body.AtKey("seqno").GetInt64()
	if err != nil {
		return nil, nil, nil, fmt.Errorf("merkle/root response does not contain seqno: %v", err)
	}
	if lastSeqno != nil && *lastSeqno == keybase1.Seqno(seqno) {
		// here we can ignore the rest of the server response (the server
		// should not send it anyways), as lastRoot is still the most recent
		// root
		m.Debug("The server indicated that the root at seqno %v (which we have) is the most recent, shortcircuiting the root parsing and validation.", seqno)
		return nil, nil, nil, nil
	}

	mr, err = readRootFromAPIRes(m, apiRes.Body, opts)
	if err != nil {
		return nil, nil, nil, err
	}
	ss, err = mc.readSkipSequenceFromAPIRes(m, apiRes, mr, lastRoot)
	if err != nil {
		return nil, nil, nil, err
	}
	return mr, ss, apiRes, err
}

func (mc *MerkleClient) lookupLeafAndPathUser(m MetaContext, q HTTPArgs, sigHints *SigHints, root *MerkleRoot, opts MerkleOpts) (vp *VerificationPath, userInfo *merkleUserInfoT, apiRes *APIRes, err error) {
	opts.isUser = true
	vp, apiRes, err = mc.lookupLeafAndPath(m, q, root, sigHints, opts)
	if err != nil {
		return nil, nil, nil, err
	}

	if sigHints != nil {
		if err = sigHints.RefreshWith(m, apiRes.Body.AtKey("sigs")); err != nil {
			return nil, nil, nil, err
		}
	}

	userInfo, err = mc.readUserFromAPIRes(m, apiRes)
	if err != nil {
		return nil, nil, nil, err
	}

	return vp, userInfo, apiRes, nil
}

func (mc *MerkleClient) lookupLeafAndPath(m MetaContext, q HTTPArgs, root *MerkleRoot, sigHints *SigHints, opts MerkleOpts) (vp *VerificationPath, res *APIRes, err error) {
	apiRes, root, err := mc.lookupLeafAndPathHelper(m, q, sigHints, root, opts)
	if err != nil {
		return nil, nil, err
	}

	vp, err = mc.readPathFromAPIRes(m, apiRes, opts)
	if err != nil {
		return nil, nil, err
	}
	vp.root = root

	return vp, apiRes, nil
}

// `MerkleOpts.isUser` is true for loading a user and false for loading a team.
func (mc *MerkleClient) lookupLeafAndPathHelper(m MetaContext, q HTTPArgs, sigHints *SigHints, root *MerkleRoot, opts MerkleOpts) (apiRes *APIRes, newRoot *MerkleRoot, err error) {
	defer m.VTrace(VLog1, "MerkleClient#lookupLeafAndPathHelper", &err)()

	for i := 0; i < 5; i++ {
		apiRes, rootRefreshNeeded, err := mc.lookupLeafAndPathHelperOnce(m, q, sigHints, root, opts)
		if err != nil {
			return nil, nil, err
		}
		if !rootRefreshNeeded {
			return apiRes, root, err
		}

		m.Debug("Server suggested a root refresh is necessary")
		root, err = mc.FetchRootFromServer(m, 0)
		if err != nil {
			return nil, nil, err
		}
	}

	return nil, nil, fmt.Errorf("Too many server requests to refresh the merkle root")
}

// `isUser` is true for loading a user and false for loading a team.
func (mc *MerkleClient) lookupLeafAndPathHelperOnce(m MetaContext, q HTTPArgs, sigHints *SigHints, root *MerkleRoot, opts MerkleOpts) (apiRes *APIRes, rootRefreshNeeded bool, err error) {
	defer m.VTrace(VLog1, "MerkleClient#lookupLeafAndPathHelperOnce", &err)()

	if !opts.NoServerPolling {
		// Poll for 10s and ask for a race-free state.
		w := 10 * int(CITimeMultiplier(mc.G()))
		q.Add("poll", I{w})
	}

	q.Add("c", B{true})
	if opts.isUser {
		q.Add("load_deleted", B{true})
		q.Add("load_reset_chain", B{true})
	}

	// Add the local db sigHints version
	if sigHints != nil {
		q.Add("sig_hints_low", I{sigHints.version})
	}

	// Get back a path from the leaf to the current merkle root. The root itself
	// is not included.
	tail := root.Seqno()
	if tail != nil {
		q.Add("tail", I{int(*tail)})
	}

	apiRes, err = m.G().API.Get(m, APIArg{
		Endpoint:       "merkle/path",
		SessionType:    APISessionTypeOPTIONAL,
		Args:           q,
		AppStatusCodes: []int{SCOk, SCNotFound, SCDeleted, SCMerkleUpdateRoot},
	})

	if err != nil {
		return nil, false, err
	}

	switch apiRes.AppStatus.Code {
	case SCMerkleUpdateRoot:
		// Server indicated that a refetch of the root is needed
		return nil, true, nil
	case SCOk:
		err = assertRespSeqnoPrecedesCurrentRoot(apiRes, root)
		if err != nil {
			return nil, false, err
		}
	// TRIAGE-2068
	case SCNotFound:
		return nil, false, NotFoundError{}
	case SCDeleted:
		return nil, false, UserDeletedError{}
	}
	return apiRes, false, nil
}

func assertRespSeqnoPrecedesCurrentRoot(apiRes *APIRes, root *MerkleRoot) error {
	resSeqno, err := apiRes.Body.AtKey("root").AtKey("seqno").GetInt64()
	if err != nil {
		return err
	}
	if keybase1.Seqno(resSeqno) > *root.Seqno() {
		// The server should have returned SCMerkleUpdateRoot instead
		return MerkleClientError{m: fmt.Sprintf("The server unexpectedly returned root (%v) ahead of the last one we know about (%v) instead of asking to update", keybase1.Seqno(resSeqno), *root.Seqno())}
	}
	return nil
}

func readSkipSequenceFromStringList(v []string) (ret SkipSequence, err error) {
	for _, s := range v {
		var p MerkleRootPayload
		if p, err = NewMerkleRootPayloadFromJSONString(s); err != nil {
			return nil, err
		}
		ret = append(ret, p)
	}
	return ret, nil
}

func (mc *MerkleClient) readAndCheckRootFromAPIRes(m MetaContext, apiRes *APIRes, currentRoot *MerkleRoot, opts MerkleOpts) (newRoot *MerkleRoot, err error) {
	newRoot, err = readRootFromAPIRes(m, apiRes.Body.AtKey("root"), opts)
	if err != nil {
		return nil, err
	}
	ss, err := mc.readSkipSequenceFromAPIRes(m, apiRes, newRoot, currentRoot)
	if err != nil {
		return nil, err
	}
	err = mc.verifySkipSequenceAndRoot(m, ss, newRoot, currentRoot, apiRes, opts)
	if err != nil {
		return nil, err
	}
	return newRoot, nil
}

func readRootFromAPIRes(m MetaContext, jw *jsonw.Wrapper, opts MerkleOpts) (*MerkleRoot, error) {
	ret, err := NewMerkleRootFromJSON(jw, opts)
	if err != nil {
		return nil, err
	}
	if chk := GetMerkleCheckpoint(m); chk != nil && *ret.Seqno() < *chk.Seqno() {
		msg := fmt.Sprintf("got unexpected early root %d < %d", *ret.Seqno(), *chk.Seqno())
		m.Error("checkpoint failure: %s", msg)
		return nil, NewClientMerkleFailedCheckpointError(msg)
	}
	ret.fetched = m.G().Clock().Now()
	return ret, nil
}

// readSkipSequenceFromAPIRes returns a SkipSequence. We construct the sequence by starting with the
// most recent merkle root, adding the "skip" pointers returned by the server, and finally bookending
// with the merkle root we last fetched from the DB. In verifySkipSequence, we walk over this Sequence
// to make sure that it obeys proper construction.
func (mc *MerkleClient) readSkipSequenceFromAPIRes(m MetaContext, res *APIRes, thisRoot *MerkleRoot, lastRoot *MerkleRoot) (ret SkipSequence, err error) {
	defer m.VTrace(VLog1, "MerkleClient#readSkipSequenceFromAPIRes", &err)()
	if lastRoot == nil {
		m.VLogf(VLog0, "| lastRoot==nil")
		return nil, nil
	}
	if !thisRoot.HasSkips() {
		m.VLogf(VLog0, "| thisRoot has no skips")
		return nil, nil
	}
	skips := res.Body.AtKey("skips")

	if skips.IsNil() {
		m.VLogf(VLog1, "| skip list from API server is nil")
		return nil, nil
	}

	var v []string
	if err = skips.UnmarshalAgain(&v); err != nil {
		m.VLogf(VLog0, "| failed to unmarshal skip list as a list of strings")
		return nil, err
	}

	ret, err = readSkipSequenceFromStringList(v)
	if err != nil {
		return nil, err
	}

	// Create the skip sequence by bookending the list the server replies with
	// with: (1) the most recent root, sent back in this reply; and (2) our last
	// root, which we read out of cache (in memory or on disk). HOWEVER, in the
	// case of lookup up historical roots, the ordering might be reversed.  So
	// we swap in that case.

	left, right := thisRoot.payload, lastRoot.payload
	if left.seqno() < right.seqno() {
		left, right = right, left
	}

	ret = append(SkipSequence{left}, ret...)
	ret = append(ret, right)

	return ret, nil
}

func (mc *MerkleClient) readUserFromAPIRes(m MetaContext, res *APIRes) (userInfo *merkleUserInfoT, err error) {
	userInfo = &merkleUserInfoT{}

	userInfo.uid, err = GetUID(res.Body.AtKey("uid"))
	if err != nil {
		return nil, err
	}

	// We don't trust this version, but it's useful to tell us if there
	// are new versions unsigned data, like basics, and maybe uploaded
	// keys
	userInfo.idVersion, err = res.Body.AtKey("id_version").GetInt64()
	if err != nil {
		return nil, err
	}

	userInfo.uidPath, err = importPathFromJSON(res.Body.AtKey("uid_proof_path"))
	if err != nil {
		return nil, err
	}

	userInfo.username, err = res.Body.AtKey("username").GetString()
	if err != nil {
		return nil, err
	}
	userInfo.usernameCased, _ = res.Body.AtKey("username_cased").GetString()

	userInfo.unverifiedResetChain, err = importResetChainFromServer(m, res.Body.AtKey("reset_chain"))
	if err != nil {
		return nil, err
	}

	return userInfo, nil
}

func (mc *MerkleClient) readPathFromAPIRes(m MetaContext, res *APIRes, opts MerkleOpts) (vp *VerificationPath, err error) {
	defer m.VTrace(VLog1, "MerkleClient#readPathFromAPIRes", &err)()

	vp = &VerificationPath{
		Contextified: NewContextified(mc.G()),
	}

	vp.path, err = importPathFromJSON(res.Body.AtKey("path"))
	if err != nil {
		return nil, err
	}

	return vp, nil
}

func pathStepFromJSON(jw *jsonw.Wrapper) (ps *PathStep, err error) {

	var prefix string
	pw := jw.AtKey("prefix")
	if !pw.IsNil() {
		var s string
		if s, err = pw.GetString(); err != nil {
			return
		}
		prefix = s
	}
	node, err := jw.AtKey("node").AtKey("val").GetString()
	if err != nil {
		return
	}
	ps = &PathStep{prefix, node}
	return
}

func (mc *MerkleClient) LastRoot(m MetaContext) *MerkleRoot {
	mc.RLock()
	defer mc.RUnlock()
	if mc.lastRoot == nil {
		return nil
	}
	ret := mc.lastRoot
	chk := GetMerkleCheckpoint(m)
	if chk != nil && *ret.Seqno() < *chk.Seqno() {
		ret = chk
	}
	return ret.ShallowCopy()
}

func (mr MerkleRoot) ExportToAVDL(g *GlobalContext) keybase1.MerkleRootAndTime {
	hashMeta := mr.ShortHash()
	return keybase1.MerkleRootAndTime{
		Root: keybase1.MerkleRootV2{
			Seqno:    mr.payload.unpacked.Body.Seqno,
			HashMeta: hashMeta[:],
		},
		UpdateTime: keybase1.TimeFromSeconds(mr.payload.unpacked.Ctime),
		FetchTime:  keybase1.ToTime(mr.fetched),
	}
}

// storeRoot stores the root in the db and mem.
// Must be called from under a lock.
func (mc *MerkleClient) storeRoot(m MetaContext, root *MerkleRoot) {
	m.VLogf(VLog0, "storing merkle root: %d", *root.Seqno())
	err := mc.G().LocalDb.Put(merkleHeadKey(), nil, root.ToJSON())
	if err != nil {
		m.Error("Cannot commit Merkle root to local DB: %s", err)
	} else {
		mc.lastRoot = root
	}
}

func (mc *MerkleClient) firstExaminableHistoricalRootProd(m MetaContext) *keybase1.Seqno {
	chk := GetMerkleCheckpoint(m)
	var ret *keybase1.Seqno
	if chk != nil {
		ret = chk.Seqno()
	}
	if ret == nil || FirstProdMerkleSeqnoWithSkips > *ret {
		ret = &FirstProdMerkleSeqnoWithSkips
	}
	return ret
}

func (mc *MerkleClient) FirstExaminableHistoricalRoot(m MetaContext) *keybase1.Seqno {

	if mc.G().Env.GetRunMode() == ProductionRunMode {
		return mc.firstExaminableHistoricalRootProd(m)
	}

	ret := mc.getFirstSkip()
	if ret != nil {
		return ret
	}

	ret = mc.getFirstSkipFromServer(m)
	return ret
}

func (mc *MerkleClient) getFirstSkip() *keybase1.Seqno {
	mc.RLock()
	defer mc.RUnlock()
	return mc.firstSkip
}

type firstSkipRaw struct {
	Status AppStatus      `json:"status"`
	Seqno  keybase1.Seqno `json:"seqno"`
}

func (r *firstSkipRaw) GetAppStatus() *AppStatus {
	return &r.Status
}

func (mc *MerkleClient) getFirstSkipFromServer(m MetaContext) *keybase1.Seqno {

	var raw firstSkipRaw
	err := m.G().API.GetDecode(m, APIArg{
		Endpoint:       "merkle/first_root_with_skips",
		SessionType:    APISessionTypeNONE,
		AppStatusCodes: []int{SCOk},
	}, &raw)

	if err != nil {
		m.Debug("failed to fetch first skip from server: %v", err)
		return nil
	}

	m.Debug("Got back seqno=%v as first merkle root with skips", raw.Seqno)

	mc.Lock()
	mc.firstSkip = &raw.Seqno
	mc.Unlock()

	return &raw.Seqno
}

func (mc *MerkleClient) firstMainRootWithHiddenRootHashProd(m MetaContext) (s keybase1.Seqno) {
	return FirstProdMerkleSeqnoWithHiddenRootHash
}

func (mc *MerkleClient) FirstMainRootWithHiddenRootHash(m MetaContext) (s keybase1.Seqno, err error) {
	if mc.G().Env.GetRunMode() == ProductionRunMode {
		return mc.firstMainRootWithHiddenRootHashProd(m), nil
	}

	s = mc.getFirstMainRootWithHiddenRootHash()
	if s != 0 {
		return s, nil
	}

	return mc.getFirstMainRootWithHiddenRootHashFromServer(m)
}

func (mc *MerkleClient) getFirstMainRootWithHiddenRootHash() keybase1.Seqno {
	mc.RLock()
	defer mc.RUnlock()
	return mc.firstRootWithHidden
}

type firstHiddenSeqnoRaw struct {
	Status AppStatus      `json:"status"`
	Seqno  keybase1.Seqno `json:"seqno"`
}

func (r *firstHiddenSeqnoRaw) GetAppStatus() *AppStatus {
	return &r.Status
}

func (mc *MerkleClient) getFirstMainRootWithHiddenRootHashFromServer(m MetaContext) (s keybase1.Seqno, err error) {

	var raw firstHiddenSeqnoRaw
	err = m.G().API.GetDecode(m, APIArg{
		Endpoint:       "merkle/first_root_with_hidden",
		SessionType:    APISessionTypeNONE,
		AppStatusCodes: []int{SCOk},
	}, &raw)

	if err != nil {
		m.Debug("failed to fetch first main root with hidden from server: %v", err)
		return 0, fmt.Errorf("failed to fetch first main root with hidden from server: %v", err)
	}

	m.Debug("Got back seqno=%v as first merkle root with hidden root hash", raw.Seqno)

	mc.Lock()
	mc.firstRootWithHidden = raw.Seqno
	mc.Unlock()

	return raw.Seqno, nil
}

func (mc *MerkleClient) findValidKIDAndSig(root *MerkleRoot) (keybase1.KID, string, error) {
	if v, err := root.sigs.Keys(); err == nil {
		for _, s := range v {
			kid := keybase1.KIDFromString(s)
			if !mc.keyring.IsValidKID(kid) {
				continue
			} else if sig, err := root.sigs.AtKey(s).AtKey("sig").GetString(); err == nil {
				return kid, sig, nil
			}
		}
	}
	var nilKID keybase1.KID
	return nilKID, "", MerkleClientError{"no known verifying key", merkleErrorNoKnownKey}
}

func (mc *MerkleClient) verifySkipSequence(m MetaContext, ss SkipSequence, thisRoot *MerkleRoot, lastRoot *MerkleRoot, opts MerkleOpts) (err error) {
	defer m.VTrace(VLog1, "MerkleClient#verifySkipSequence", &err)()

	var left, right keybase1.Seqno
	if thisRoot.Seqno() != nil {
		left = *thisRoot.Seqno()
	}
	if lastRoot.Seqno() != nil {
		right = *lastRoot.Seqno()
	}

	// In historical queries (for which we fetch old roots), we check the skip
	// sequence in the opposite direction.
	if opts.historical {
		left, right = right, left
	}

	// In this case, the server did not return a skip sequence. It's OK if
	// the last known root is too old. It's not OK if the last known root is
	// from after the server starting providing skip pointers.
	if ss == nil {
		m.VLogf(VLog1, "| nil SkipSequence")
		fss := mc.FirstExaminableHistoricalRoot(m)
		if lastRoot == nil {
			m.VLogf(VLog1, "| lastRoot==nil, so OK")
			return nil
		}
		if fss == nil {
			m.VLogf(VLog1, "| no known root with skips, so OK")
			return nil
		}
		if *fss > right {
			m.VLogf(VLog1, "| right marker (%d) is from before first known root with skips (%d), so OK", int(right), int(*fss))
			return nil
		}
		if *fss > left {
			m.VLogf(VLog1, "| left marker (%d) is from before first known root with skips (%d), so OK", int(left), int(*fss))
			return nil
		}
		if thisRoot != nil && *lastRoot.Seqno() == *thisRoot.Seqno() {
			m.VLogf(VLog1, "| thisRoot is the same as lastRoot (%d), so OK", int(*lastRoot.Seqno()))
			return nil
		}
		return MerkleClientError{fmt.Sprintf("Expected a skip sequence with last=%d", int(*lastRoot.Seqno())), merkleErrorNoSkipSequence}
	}

	if left == right {
		m.VLogf(VLog1, "| No change since last check (seqno %d)", *thisRoot.Seqno())
		return nil
	}
	return ss.verify(m, left, right)
}

// verify verifies the raw "Skip Sequence" ss. ss contains a list of MerkleRootPayloads beginning
// with the most recently returned root, and ending with the last root that we fetched. So for instance,
// it might contain: [ 100, 84, 82, 81 ] in that case that we last fetched Seqno=81 and the server is
// currently at Seqno=100.
func (ss SkipSequence) verify(m MetaContext, thisRoot keybase1.Seqno, lastRoot keybase1.Seqno) (err error) {
	defer m.VTrace(VLog1, "SkipSequence#verify", &err)()

	expectedSkips, err := computeLogPatternMerkleSkips(lastRoot, thisRoot)
	if err != nil {
		return MerkleClientError{fmt.Sprintf("Failed to compute expected skip pattern: %s", err), merkleErrorWrongSkipSequence}
	}
	// Don't check bookends that were added by client
	if len(expectedSkips)+2 != len(ss) {
		return MerkleClientError{fmt.Sprintf("Wrong number of skips: expected %d, got %d.", len(expectedSkips)+2, len(ss)), merkleErrorWrongSkipSequence}
	}

	for index := 1; index < len(ss)-1; index++ {
		root := ss[index].seqno()
		if keybase1.Seqno(expectedSkips[index-1]) != root {
			return MerkleClientError{fmt.Sprintf("Unexpected skip index: expected %d, got %d.", expectedSkips[index-1], root), merkleErrorWrongSkipSequence}
		}
	}

	const maxClockDriftSeconds int64 = 5 * 60
	var totalDrift int64

	for index := 0; index < len(ss)-1; index++ {
		nextIndex := index + 1
		thisRoot, prevRoot := ss[index].seqno(), ss[nextIndex].seqno()
		m.VLogf(VLog1, "| Checking skip %d->%d", thisRoot, prevRoot)

		// Next compare the skip pointer in this merkle root against the hash of the previous
		// root in the merkle root sequence. They must be equal.
		hash := ss[index].skipToSeqno(prevRoot)
		if hash == nil || hash.IsNil() {
			return MerkleClientError{fmt.Sprintf("Skip missing at %d->%d", thisRoot, prevRoot), merkleErrorSkipMissing}
		}
		if !hashEq(hash, ss[nextIndex].shortHash()) {
			m.VLogf(VLog0, "| Failure in hashes: %s != %s", hash.String(), ss[nextIndex].shortHash().String())
			return MerkleClientError{fmt.Sprintf("Skip pointer mismatch at %d->%d", thisRoot, prevRoot), merkleErrorSkipHashMismatch}
		}

		// Check that ctimes in the sequence are nearly strictly ordered; we have to make sure we can handle slight
		// clock jitters since the server might need to rewind time due to leap seconds or NTP issues.
		// We'll allow at most 5 minutes of "time-travel" between 2 updates, and no more than 5minutes of time travel
		// across the whole sequence
		thisCTime, prevCTime := ss[index].ctime(), ss[nextIndex].ctime()
		if prevCTime > thisCTime {
			drift := prevCTime - thisCTime
			if drift > maxClockDriftSeconds {
				return MerkleClientError{
					fmt.Sprintf("Out of order ctimes: %d at %d should not have come before %d at %d (even with %ds tolerance)", thisRoot, thisCTime, prevRoot, prevCTime, maxClockDriftSeconds),
					merkleErrorOutOfOrderCtime,
				}
			}
			totalDrift += drift
		}
	}

	if totalDrift > maxClockDriftSeconds {
		return MerkleClientError{
			fmt.Sprintf("Too much clock drift detected (%ds) in skip sequence", totalDrift),
			merkleErrorTooMuchClockDrift,
		}

	}

	return nil
}

func (mc *MerkleClient) verifyRootHelper(m MetaContext, newRoot *MerkleRoot, currentRoot *MerkleRoot, opts MerkleOpts) (err error) {
	defer m.VTrace(VLog1, fmt.Sprintf("merkleClient#verifyRootHelper(root=%d, cached=%v, opts=%+v)", int(*newRoot.Seqno()), currentRoot.Seqno() == nil, opts), &err)()

	// First make sure it's not a rollback. If we're doing an historical lookup, it's
	// actual OK.
	if !opts.historical && currentRoot != nil && *currentRoot.Seqno() > *newRoot.Seqno() {
		return fmt.Errorf("Server rolled back Merkle tree: %d > %d", *currentRoot.Seqno(), *newRoot.Seqno())
	}

	if currentRoot != nil && currentRoot.ShortHash() == newRoot.ShortHash() {
		// the new root is the same as the old one, no need to check it again
		return nil
	}

	kid, sig, err := mc.findValidKIDAndSig(newRoot)
	if err != nil {
		return err
	}
	m.VLogf(VLog1, "+ Merkle: using KID=%s for verifying server sig", kid)

	key, err := mc.keyring.Load(m, kid)
	if err != nil {
		return err
	}

	if key == nil {
		return MerkleClientError{"no known verifying key", merkleErrorNoKnownKey}
	}

	// Actually run the PGP verification over the signature
	_, err = key.VerifyString(mc.G().Log, sig, []byte(newRoot.payload.packed))
	if err != nil {
		return err
	}

	skips := newRoot.payload.unpacked.Body.Skips
	if err := verifyRootSkips(*newRoot.Seqno(), skips); err != nil {
		return err
	}

	m.VLogf(VLog1, "- Merkle: server sig verified")

	return nil
}

func verifyRootSkips(rootSeqno keybase1.Seqno, skips SkipTable) error {
	expectedSkips := computeExpectedRootSkips(uint(rootSeqno))
	if len(expectedSkips) != len(skips) {
		return MerkleClientError{fmt.Sprintf("Root check: wrong number of skips: expected %d, got %d.", len(expectedSkips), len(skips)), merkleErrorWrongRootSkips}
	}
	for _, expectedSkip := range expectedSkips {
		seqno := keybase1.Seqno(expectedSkip)
		_, ok := skips[seqno]
		if !ok {
			return MerkleClientError{fmt.Sprintf("Root check: unexpected skip index: wanted %d, but did not exist.", seqno), merkleErrorWrongRootSkips}
		}
	}
	return nil
}

func computeExpectedRootSkips(start uint) []uint {
	if start <= 1 {
		return nil
	}
	high := int(math.Ceil(math.Log2(float64(start))))
	ret := make([]uint, high)
	for i, skip := 0, uint(1); i < high; i, skip = i+1, skip*2 {
		ret[i] = start - skip
	}
	return ret
}

func parseTriple(jw *jsonw.Wrapper) (*MerkleTriple, error) {
	if jw.IsNil() {
		return nil, nil
	}

	l, err := jw.Len()
	if err != nil {
		return nil, err
	}
	if l == 0 {
		return nil, nil
	}
	if l == 1 {
		return nil, fmt.Errorf("Bad merkle 'triple', with < 2 values")
	}
	if l > 3 {
		return nil, fmt.Errorf("Bad merkle triple, with > 3 values")
	}
	seqno, err := jw.AtIndex(0).GetInt64()
	if err != nil {
		return nil, err
	}
	li, err := GetLinkID(jw.AtIndex(1))
	if err != nil {
		return nil, err
	}

	var si keybase1.SigIDBase
	if l == 3 {
		si, err = GetSigIDBase(jw.AtIndex(2))
		if err != nil {
			return nil, err
		}
	}

	return &MerkleTriple{keybase1.Seqno(seqno), li, si}, nil

}

func parseV1(jw *jsonw.Wrapper) (user *MerkleUserLeaf, err error) {
	var t *MerkleTriple
	if t, err = parseTriple(jw); err == nil {
		user = &MerkleUserLeaf{
			public:  t,
			private: nil,
		}
	}
	return
}
func parseV2(jw *jsonw.Wrapper) (*MerkleUserLeaf, error) {
	user := MerkleUserLeaf{}

	l, err := jw.Len()
	if err != nil {
		return nil, err
	}
	if l < 2 {
		return nil, fmt.Errorf("No public chain.")
	}

	user.public, err = parseTriple(jw.AtIndex(1))
	if err != nil {
		return nil, err
	}

	if l >= 3 {
		user.private, err = parseTriple(jw.AtIndex(2))
		if err != nil {
			return nil, err
		}
	}

	if l >= 4 && !jw.AtIndex(3).IsNil() {
		eldest, err := GetKID(jw.AtIndex(3))
		if err != nil {
			return nil, err
		}
		user.eldest = eldest
	}

	if l >= 5 {
		user.resets, err = parseV2LeafResetChainTail(jw.AtIndex(4))
		if err != nil {
			return nil, err
		}
	}

	return &user, nil
}

func parseMerkleUserLeaf(m MetaContext, jw *jsonw.Wrapper, g *GlobalContext) (user *MerkleUserLeaf, err error) {
	m.VLogf(VLog1, "+ ParsingMerkleUserLeaf")

	if jw == nil {
		m.VLogf(VLog0, "| empty leaf found; user wasn't in tree")
		user = &MerkleUserLeaf{}
		return
	}

	l, err := jw.Len()
	if err != nil {
		return
	}
	if l < 2 {
		err = fmt.Errorf("Expected an array of length 2 or more")
		return
	}

	v, err := jw.AtIndex(0).GetInt()

	if err != nil {
		return
	}

	// We messed up and didn't version the initial leafs of the tree
	if _, e2 := jw.AtIndex(1).GetString(); e2 == nil {
		v = 1
	}

	switch v {
	case 1:
		user, err = parseV1(jw)
	case 2:
		user, err = parseV2(jw)
	default:
		err = fmt.Errorf("Unexpected version: %d", v)
	}

	m.VLogf(VLog1, "- ParsingMerkleUserLeaf -> %v", ErrToOk(err))
	return
}

func parseMerkleTeamLeaf(m MetaContext, jw *jsonw.Wrapper, g *GlobalContext) (leaf *MerkleTeamLeaf, err error) {
	m.VLogf(VLog1, "+ ParsingMerkleTeamLeaf")

	if jw == nil {
		m.VLogf(VLog0, "| empty leaf found; team wasn't in tree")
		leaf = &MerkleTeamLeaf{}
		return
	}

	l, err := jw.Len()
	if err != nil {
		return
	}
	// length should be 4, but only use the first 3, and allow larger for forward compatibility.
	if l < 3 {
		err = fmt.Errorf("Expected an array of length >=3 but got %v", l)
		return
	}

	v, err := jw.AtIndex(0).GetInt()
	if err != nil {
		return
	}
	if v != 2 {
		err = fmt.Errorf("Expected version 2 but got %v", v)
		return
	}

	public, err := parseTriple(jw.AtIndex(1))
	if err != nil {
		return
	}

	private, err := parseTriple(jw.AtIndex(2))
	if err != nil {
		return
	}

	m.VLogf(VLog1, "- ParsingMerkleTeamLeaf -> %v", ErrToOk(err))
	return &MerkleTeamLeaf{
		// TeamID is filled in by the caller
		Public:  public,
		Private: private,
	}, err
}

func (vp *VerificationPath) verifyUsername(m MetaContext, userInfo merkleUserInfoT) (username string, err error) {
	if CheckUIDAgainstUsername(userInfo.uid, userInfo.username) == nil {
		m.VLogf(VLog1, "| Username %s mapped to %s via direct hash", userInfo.username, userInfo.uid)
		username = userInfo.username
		return
	}

	m.VLogf(VLog1, "| Failed to map Username %s -> UID %s via direct hash", userInfo.username, userInfo.uid)

	if userInfo.usernameCased != userInfo.username && strings.ToLower(userInfo.usernameCased) == userInfo.username {
		m.VLogf(VLog1, "| Checking cased username difference: %s v %s", userInfo.username, userInfo.usernameCased)
		if checkUIDAgainstCasedUsername(userInfo.uid, userInfo.usernameCased) == nil {
			m.VLogf(VLog1, "| Username %s mapped to %s via direct hash (w/ username casing)", userInfo.usernameCased, userInfo.uid)
			username = userInfo.username
			return
		}
	}

	hsh := sha256.Sum256([]byte(strings.ToLower(userInfo.username)))
	hshS := hex.EncodeToString(hsh[:])
	var leaf *jsonw.Wrapper

	if vp.root.LegacyUIDRootHash() == nil {
		err = MerkleClientError{"no legacy UID root hash found in root", merkleErrorNoLegacyUIDRoot}
		return
	}

	if leaf, err = userInfo.uidPath.VerifyPath(vp.root.LegacyUIDRootHash(), hshS); err != nil {
		return
	}

	var uid2 keybase1.UID
	if uid2, err = GetUID(leaf); err != nil {
		return
	}
	if userInfo.uid.NotEqual(uid2) {
		err = UIDMismatchError{fmt.Sprintf("UID %s != %s via merkle tree", uid2, userInfo.uid)}
		return
	}

	m.VLogf(VLog1, "| Username %s mapped to %s via Merkle lookup", userInfo.username, userInfo.uid)
	username = userInfo.username

	return
}

func (vp *VerificationPath) verifyUser(m MetaContext, uid keybase1.UID) (user *MerkleUserLeaf, err error) {
	curr := vp.root.RootHash()

	var leaf *jsonw.Wrapper
	leaf, err = vp.path.VerifyPath(curr, uid.String())

	if leaf != nil && err == nil {
		if leaf, err = leaf.ToArray(); err != nil {
			msg := fmt.Sprintf("Didn't find a leaf for user in tree: %s", err)
			err = MerklePathNotFoundError{uid.String(), msg}
		}
	}

	if err == nil {
		// noop
	} else if _, ok := err.(MerklePathNotFoundError); ok {
		m.VLogf(VLog0, fmt.Sprintf("In checking Merkle tree: %s", err))
	} else {
		return
	}

	user, err = parseMerkleUserLeaf(m, leaf, vp.G())
	if user != nil {
		user.uid = uid
	}
	return
}

func (vp *VerificationPath) verifyTeam(m MetaContext, teamID keybase1.TeamID) (teamLeaf *MerkleTeamLeaf, err error) {
	curr := vp.root.RootHash()

	var leaf *jsonw.Wrapper
	leaf, err = vp.path.VerifyPath(curr, teamID.String())

	if leaf != nil && err == nil {
		if leaf, err = leaf.ToArray(); err != nil {
			msg := fmt.Sprintf("Didn't find a leaf for team in tree: %s", err)
			err = MerklePathNotFoundError{teamID.String(), msg}
		}
	}

	if err == nil {
		// noop
	} else if _, ok := err.(MerklePathNotFoundError); ok {
		m.VLogf(VLog0, fmt.Sprintf("In checking Merkle tree: %s", err))
	} else {
		return
	}

	teamLeaf, err = parseMerkleTeamLeaf(m, leaf, vp.G())
	if teamLeaf != nil {
		teamLeaf.TeamID = teamID
	}
	return
}

func (path PathSteps) VerifyPath(curr NodeHash, uidS string) (juser *jsonw.Wrapper, err error) {

	bpath := uidS
	lastTyp := 0

	for i, step := range path {
		payload := step.node
		if !curr.Check(payload) {
			err = fmt.Errorf("Hash mismatch at level=%d", i)
			break
		}

		var jw *jsonw.Wrapper
		jw, err = jsonw.Unmarshal([]byte(payload))
		if err != nil {
			err = fmt.Errorf("Can't parse JSON at level=%d: %s", i, err)
			break
		}

		plen := len(step.prefix)
		if plen > len(bpath) {
			err = fmt.Errorf("Path prefix longer than identifier: %v > %v", plen, len(bpath))
			return nil, err
		}
		if plen > 0 && bpath[:plen] != step.prefix {
			err = fmt.Errorf("Path mismatch at level %d: %s != %s", i, bpath[:plen], step.prefix)
			break
		}

		lastTyp, err = jw.AtKey("type").GetInt()
		if err != nil {
			err = fmt.Errorf("At level %d, failed to get a valid 'type'", i)
			break
		}

		if lastTyp == MerkleTreeNode {
			if plen == 0 {
				err = fmt.Errorf("Empty prefix len at level=%d", i)
				return
			}
			curr, err = GetNodeHash(jw.AtKey("tab").AtKey(step.prefix))
			if err != nil {
				err = MerklePathNotFoundError{uidS, err.Error()}
				break
			}
			juser = nil
		} else {
			juser = jw.AtKey("tab").AtKey(uidS)
		}
	}

	if err == nil && juser == nil {
		err = MerklePathNotFoundError{uidS, "tree path didn't end in a leaf"}
	}
	return
}

func (mc *MerkleClient) verifySkipSequenceAndRoot(m MetaContext, ss SkipSequence, curr *MerkleRoot, prev *MerkleRoot, apiRes *APIRes, opts MerkleOpts) (err error) {

	defer func() {
		if err != nil {
			m.VLogf(VLog0, "| Full APIRes was: %s", apiRes.Body.MarshalToDebug())
		}
	}()

	// It's important to check the merkle skip sequence before verifying the root.
	if err = mc.verifySkipSequence(m, ss, curr, prev, opts); err != nil {
		return err
	}
	if opts.noSigCheck {
		m.VLogf(VLog0, "| noSigCheck wanted, so skipping out")
		return nil
	}
	return mc.verifyRootHelper(m, curr, prev, opts)
}

func (mc *MerkleClient) LookupUser(m MetaContext, q HTTPArgs, sigHints *SigHints, opts MerkleOpts) (u *MerkleUserLeaf, err error) {

	m.VLogf(VLog0, "+ MerkleClient.LookupUser(%v)", q)

	if err = mc.init(m); err != nil {
		return nil, err
	}

	root, err := mc.FetchRootFromServer(m, DefaultMerkleRootFreshness)
	if err != nil {
		return nil, err
	}

	path, userInfo, _, err := mc.lookupLeafAndPathUser(m, q, sigHints, root, opts)
	if err != nil {
		return nil, err
	}
	// spot check that the user-specific path attributes were filled
	if userInfo.uid.IsNil() {
		return nil, fmt.Errorf("verification path has nil UID")
	}

	if u, err = path.verifyUser(m, userInfo.uid); err != nil {
		return nil, err
	}

	if u.username, err = path.verifyUsername(m, *userInfo); err != nil {
		return nil, err
	}

	if err = u.resets.verifyAndLoad(m, userInfo.unverifiedResetChain); err != nil {
		return nil, err
	}

	u.idVersion = userInfo.idVersion

	m.VLogf(VLog0, "- MerkleClient.LookupUser(%v) -> OK", q)
	return u, nil
}

func (vp *VerificationPath) verifyUserOrTeam(m MetaContext, id keybase1.UserOrTeamID) (leaf *MerkleGenericLeaf, err error) {

	if id.IsUser() {
		user, err := vp.verifyUser(m, id.AsUserOrBust())
		if err != nil {
			return nil, err
		}
		return user.MerkleGenericLeaf(), nil
	}

	if id.IsTeamOrSubteam() {
		team, err := vp.verifyTeam(m, id.AsTeamOrBust())
		if err != nil {
			return nil, err
		}
		return team.MerkleGenericLeaf(), nil
	}

	return nil, errors.New("id was neither a user or a team")
}

func (mc *MerkleClient) LookupLeafAtHashMeta(m MetaContext, leafID keybase1.UserOrTeamID, hm keybase1.HashMeta) (leaf *MerkleGenericLeaf, err error) {
	m.VLogf(VLog0, "+ MerkleClient.LookupLeafAtHashMeta(%v)", leafID)
	paramer := func(a *HTTPArgs) {
		a.Add("start_hash_meta", S{Val: hm.String()})
	}
	checker := func(path *VerificationPath) error {
		if !path.root.HashMeta().Eq(hm) {
			return MerkleClientError{"hash meta failed to match", merkleErrorHashMeta}
		}
		return nil
	}
	leaf, _, _, err = mc.lookupLeafHistorical(m, leafID, paramer, checker, MerkleOpts{}, nil)
	return leaf, err
}

func (mc *MerkleClient) checkHistoricalSeqno(s keybase1.Seqno) error {
	if mc.G().Env.GetRunMode() == ProductionRunMode && s < FirstProdMerkleSeqnoWithSigs {
		return MerkleClientError{fmt.Sprintf("cannot load seqno=%d; must load at %d or higher", s, FirstProdMerkleSeqnoWithSigs), merkleErrorAncientSeqno}
	}
	return nil
}

type MerkleOpts struct {
	// All used internally
	noSigCheck bool
	historical bool
	isUser     bool

	// Used externally
	NoServerPolling bool
}

func (mc *MerkleClient) LookupLeafAtSeqno(m MetaContext, leafID keybase1.UserOrTeamID, s keybase1.Seqno) (leaf *MerkleGenericLeaf, root *MerkleRoot, err error) {
	leaf, root, _, err = mc.lookupLeafAtSeqno(m, leafID, s, MerkleOpts{}, nil /* processHiddenResponseFunc */)
	return leaf, root, err
}

func (mc *MerkleClient) LookupLeafAtSeqnoForAudit(m MetaContext, leafID keybase1.UserOrTeamID, s keybase1.Seqno, processHiddenResponseFunc ProcessHiddenRespFunc) (leaf *MerkleGenericLeaf, root *MerkleRoot, hiddenResp *MerkleHiddenResponse, err error) {
	return mc.lookupLeafAtSeqno(m, leafID, s, MerkleOpts{noSigCheck: true}, processHiddenResponseFunc)
}

func (mc *MerkleClient) lookupLeafAtSeqno(m MetaContext, leafID keybase1.UserOrTeamID, s keybase1.Seqno, opts MerkleOpts, processHiddenResponseFunc ProcessHiddenRespFunc) (leaf *MerkleGenericLeaf, root *MerkleRoot, hiddenResp *MerkleHiddenResponse, err error) {
	m.VLogf(VLog0, "+ MerkleClient.lookupLeafAtSeqno(%v,%v,%v)", leafID, s, opts)
	if err = mc.checkHistoricalSeqno(s); err != nil {
		return nil, nil, nil, err
	}
	paramer := func(a *HTTPArgs) {
		a.Add("start_seqno", I{Val: int(s)})
		if opts.noSigCheck {
			a.Add("no_root_sigs", B{Val: true})
		}
	}
	// Since we are looking up a leaf at a specific seqno, ensure we have root
	// at least as recent as that seqno.
	_, err = mc.FetchRootFromServerByMinSeqno(m, s)
	if err != nil {
		return nil, nil, nil, err
	}

	checker := func(path *VerificationPath) error {
		if path.root.Seqno() == nil {
			return MerkleClientError{"no such seqno was found", merkleErrorNotFound}
		}
		if *path.root.Seqno() != s {
			return MerkleClientError{"seqno mismatch", merkleErrorBadSeqno}
		}
		return nil
	}
	return mc.lookupLeafHistorical(m, leafID, paramer, checker, opts, processHiddenResponseFunc)
}

func (mc *MerkleClient) LookupRootAtSeqno(m MetaContext, s keybase1.Seqno) (root *MerkleRoot, err error) {
	defer m.VTrace(VLog0, fmt.Sprintf("LookupRootAtSeqno(%d)", s), &err)()
	_, root, err = mc.LookupLeafAtSeqno(m, keybase1.UserOrTeamID(""), s)
	return root, err
}

func (mc *MerkleClient) lookupLeafHistorical(m MetaContext, leafID keybase1.UserOrTeamID, paramer func(*HTTPArgs), checker func(*VerificationPath) error, opts MerkleOpts, processHiddenResponseFunc ProcessHiddenRespFunc) (leaf *MerkleGenericLeaf, root *MerkleRoot, hiddenResp *MerkleHiddenResponse, err error) {
	opts.historical = true

	var path *VerificationPath
	var apiRes *APIRes

	if err = mc.init(m); err != nil {
		return nil, nil, nil, err
	}

	// The most current root we got. This might be slightly out of date, but all
	// we really care is that it points back to another historical root, which
	// should be before currentRoot. If it's not, we'll refresh currentRoot in
	// the process.
	currentRoot := mc.LastRoot(m)

	q := NewHTTPArgs()
	if leafID.IsNil() {
		q.Add("no_leaf", B{Val: true})
	} else {
		q.Add("leaf_id", S{Val: leafID.String()})
	}
	paramer(&q)

	if apiRes, currentRoot, err = mc.lookupLeafAndPathHelper(m, q, nil, currentRoot, opts); err != nil {
		return nil, nil, nil, err
	}

	path, err = mc.readPathFromAPIRes(m, apiRes, opts)
	if err != nil {
		return nil, nil, nil, err
	}
	resSeqno, err := apiRes.Body.AtKey("root").AtKey("seqno").GetInt64()
	if err != nil {
		return nil, nil, nil, err
	}
	if keybase1.Seqno(resSeqno) == *currentRoot.Seqno() {
		path.root = currentRoot
	} else {
		path.root, err = mc.readAndCheckRootFromAPIRes(m, apiRes, currentRoot, opts)
		if err != nil {
			return nil, nil, nil, err
		}
	}

	if err = checker(path); err != nil {
		return nil, nil, nil, err
	}

	if !leafID.IsNil() {
		leaf, err = path.verifyUserOrTeam(m, leafID)
		if err != nil {
			return nil, nil, nil, err
		}

		if processHiddenResponseFunc != nil {
			hiddenResp, err = processHiddenResponseFunc(m, leafID.AsTeamOrBust(), apiRes, path.root.BlindMerkleRootHash())
			if err != nil {
				return nil, nil, nil, err
			}
		}
	}

	return leaf, path.root, hiddenResp, nil
}

func (mc *MerkleClient) LookupTeamWithHidden(m MetaContext, teamID keybase1.TeamID, processHiddenRespFunc ProcessHiddenRespFunc) (leaf *MerkleTeamLeaf, hiddenResp *MerkleHiddenResponse, lastMerkleRoot *MerkleRoot, err error) {
	// Copied from LookupUser. These methods should be kept relatively in sync.
	return mc.lookupTeam(m, teamID, processHiddenRespFunc)
}

func (mc *MerkleClient) LookupTeam(m MetaContext, teamID keybase1.TeamID) (leaf *MerkleTeamLeaf, err error) {
	// Copied from LookupUser. These methods should be kept relatively in sync.
	leaf, _, _, err = mc.lookupTeam(m, teamID, nil)
	return leaf, err
}

type MerkleHiddenResponseType uint8

const (
	// the server did not include any hidden chain data
	MerkleHiddenResponseTypeNONE MerkleHiddenResponseType = 1
	// the server provided a proof of absence (or inclusion with an empty leaf) for
	// the requested key
	MerkleHiddenResponseTypeABSENCEPROOF MerkleHiddenResponseType = 2
	// the server provided a valid inclusion proof for the returned leaf in the tree
	MerkleHiddenResponseTypeOK MerkleHiddenResponseType = 3

	// All hidden checks should be skipped as the feature flag is off
	MerkleHiddenResponseTypeFLAGOFF MerkleHiddenResponseType = 127
)

type MerkleHiddenResponse struct {
	RespType            MerkleHiddenResponseType `json:"resp_type"`
	CommittedHiddenTail *sig3.Tail               `json:"committed_hidden_tail"`
	UncommittedSeqno    keybase1.Seqno           `json:"uncommitted_seqno"`
}

func (m *MerkleHiddenResponse) GetUncommittedSeqno() keybase1.Seqno {
	if m == nil {
		return 0
	}
	return m.UncommittedSeqno
}

func (m *MerkleHiddenResponse) GetCommittedSeqno() keybase1.Seqno {
	if m == nil || m.RespType != MerkleHiddenResponseTypeOK {
		return 0
	}
	return m.CommittedHiddenTail.Seqno
}

type ProcessHiddenRespFunc func(m MetaContext, teamID keybase1.TeamID, apiRes *APIRes, blindRootHash string) (*MerkleHiddenResponse, error)

func (mc *MerkleClient) lookupTeam(m MetaContext, teamID keybase1.TeamID, processHiddenResponseFunc ProcessHiddenRespFunc) (leaf *MerkleTeamLeaf, hiddenResp *MerkleHiddenResponse, lastMerkleRoot *MerkleRoot, err error) {

	m.VLogf(VLog0, "+ MerkleClient.LookupTeam(%v)", teamID)

	var path *VerificationPath
	var apiRes *APIRes
	var opts MerkleOpts

	if err = mc.init(m); err != nil {
		return nil, nil, nil, err
	}

	root, err := mc.FetchRootFromServer(m, DefaultMerkleRootFreshness)
	if err != nil {
		return nil, nil, nil, err
	}
	q := NewHTTPArgs()
	q.Add("leaf_id", S{Val: teamID.String()})

	if path, apiRes, err = mc.lookupLeafAndPath(m, q, root, nil, opts); err != nil {
		return nil, nil, nil, err
	}

	if leaf, err = path.verifyTeam(m, teamID); err != nil {
		return nil, nil, nil, err
	}

	if processHiddenResponseFunc != nil {
		hiddenResp, err = processHiddenResponseFunc(m, teamID, apiRes, path.root.BlindMerkleRootHash())
		if err != nil {
			return nil, nil, nil, err
		}
	}

	m.VLogf(VLog0, "- MerkleClient.LookupTeam(%v) -> OK", teamID)
	return leaf, hiddenResp, path.root, err
}

func (mr *MerkleRoot) ToSigJSON() (ret *jsonw.Wrapper) {

	ret = jsonw.NewDictionary()
	_ = ret.SetKey("seqno", jsonw.NewInt(int(*mr.Seqno())))
	_ = ret.SetKey("ctime", jsonw.NewInt64(mr.Ctime()))
	_ = ret.SetKey("hash", jsonw.NewString(mr.RootHash().String()))
	_ = ret.SetKey("hash_meta", jsonw.NewString(mr.ShortHash().String()))

	return
}

func (mr *MerkleRoot) ToInfo() chat1.MerkleRoot {
	return chat1.MerkleRoot{
		Seqno: int64(*mr.Seqno()),
		Hash:  mr.RootHash().bytes(),
	}
}

func (mr *MerkleRoot) ToMerkleRootV2() keybase1.MerkleRootV2 {
	return keybase1.MerkleRootV2{
		Seqno:    *mr.Seqno(),
		HashMeta: mr.HashMeta(),
	}
}

func (mc *MerkleClient) LastRootToSigJSON(m MetaContext) (ret *jsonw.Wrapper, err error) {
	// Lazy-init, only when needed.
	if err = mc.init(m); err == nil {
		mc.RLock()
		if mc.lastRoot != nil {
			ret = mc.lastRoot.ToSigJSON()
		}
		mc.RUnlock()
	}
	return
}

func (mul *MerkleUserLeaf) MatchUser(u *User, uid keybase1.UID, nun NormalizedUsername) (err error) {
	if mul.username != u.GetName() {
		err = MerkleClashError{fmt.Sprintf("vs loaded object: username %s != %s", mul.username, u.GetName())}
	} else if mul.uid.NotEqual(u.GetUID()) {
		err = MerkleClientError{fmt.Sprintf("vs loaded object: UID %s != %s", mul.uid, u.GetUID()), merkleErrorUIDMismatch}
	} else if !nun.IsNil() && !NewNormalizedUsername(mul.username).Eq(nun) {
		err = MerkleClashError{fmt.Sprintf("vs given arg: username %s != %s", mul.username, nun)}
	} else if uid.NotEqual(mul.uid) {
		err = MerkleClashError{fmt.Sprintf("vs given arg: UID %s != %s", uid, mul.uid)}
	}
	return
}

func (mt MerkleTriple) Less(mt2 MerkleTriple) bool {
	return mt.Seqno < mt2.Seqno
}

func GetMerkleTriple(jw *jsonw.Wrapper) (ret *MerkleTriple, err error) {
	var tmp MerkleTriple
	if err = jw.UnmarshalAgain(&tmp); err != nil {
		ret = &tmp
	}
	return ret, err
}

func (mr MerkleRoot) ShallowCopy() *MerkleRoot {
	return &mr
}

func (mr *MerkleRoot) Seqno() *keybase1.Seqno {
	if mr == nil {
		return nil
	}
	tmp := mr.payload.seqno()
	return &tmp
}

func (mr *MerkleRoot) RootHash() NodeHash {
	if mr == nil {
		return nil
	}
	return mr.payload.rootHash()
}

func (mr *MerkleRoot) LegacyUIDRootHash() NodeHash {
	if mr == nil {
		return nil
	}
	return mr.payload.legacyUIDRootHash()
}

func (mr *MerkleRoot) PvlHash() string {
	if mr == nil {
		return ""
	}
	return mr.payload.pvlHash()
}

func (mr *MerkleRoot) ProofServicesHash() string {
	if mr == nil {
		return ""
	}
	return mr.payload.proofServicesHash()
}

func (mr *MerkleRoot) ExternalURLHash() string {
	if mr == nil {
		return ""
	}
	return mr.payload.externalURLHash()
}

func (mr *MerkleRoot) BlindMerkleRootHash() string {
	if mr == nil {
		return ""
	}
	return mr.payload.blindMerkleRootHash()
}

func (mr *MerkleRoot) SkipToSeqno(s keybase1.Seqno) NodeHash {
	if mr == nil {
		return nil
	}
	return mr.payload.skipToSeqno(s)
}

func (mr *MerkleRoot) Ctime() int64 {
	if mr == nil {
		return 0
	}
	return mr.payload.ctime()
}

func (mr *MerkleRoot) Fetched() time.Time {
	if mr == nil {
		return time.Time{}
	}
	return mr.fetched
}

func (mr *MerkleRoot) KBFSPrivate() (keybase1.KBFSRootHash, *keybase1.Seqno) {
	if mr == nil {
		return nil, nil
	}
	return mr.payload.kbfsPrivate()
}

func (mr *MerkleRoot) KBFSPublic() (keybase1.KBFSRootHash, *keybase1.Seqno) {
	if mr == nil {
		return nil, nil
	}
	return mr.payload.kbfsPublic()
}

func (mr *MerkleRoot) KBFSPrivateTeam() (keybase1.KBFSRootHash, *keybase1.Seqno) {
	if mr == nil {
		return nil, nil
	}
	return mr.payload.kbfsPrivateTeam()
}

func (mrp MerkleRootPayload) skipToSeqno(s keybase1.Seqno) NodeHash {
	if mrp.unpacked.Body.Skips == nil {
		return nil
	}
	return mrp.unpacked.Body.Skips[s]
}

func (mrp MerkleRootPayload) seqno() keybase1.Seqno       { return mrp.unpacked.Body.Seqno }
func (mrp MerkleRootPayload) rootHash() NodeHash          { return mrp.unpacked.Body.Root }
func (mrp MerkleRootPayload) legacyUIDRootHash() NodeHash { return mrp.unpacked.Body.LegacyUIDRoot }
func (mrp MerkleRootPayload) pvlHash() string             { return mrp.unpacked.Body.PvlHash }
func (mrp MerkleRootPayload) proofServicesHash() string   { return mrp.unpacked.Body.ProofServicesHash }
func (mrp MerkleRootPayload) externalURLHash() string     { return mrp.unpacked.Body.ExternalURLHash }
func (mrp MerkleRootPayload) blindMerkleRootHash() string {
	return mrp.unpacked.Body.BlindMerkleRootHash
}
func (mrp MerkleRootPayload) ctime() int64 { return mrp.unpacked.Ctime }
func (mrp MerkleRootPayload) kbfsPrivate() (keybase1.KBFSRootHash, *keybase1.Seqno) {
	return mrp.unpacked.Body.Kbfs.Private.Root, mrp.unpacked.Body.Kbfs.Private.Version
}
func (mrp MerkleRootPayload) kbfsPublic() (keybase1.KBFSRootHash, *keybase1.Seqno) {
	return mrp.unpacked.Body.Kbfs.Public.Root, mrp.unpacked.Body.Kbfs.Public.Version
}
func (mrp MerkleRootPayload) kbfsPrivateTeam() (keybase1.KBFSRootHash, *keybase1.Seqno) {
	return mrp.unpacked.Body.Kbfs.PrivateTeam.Root, mrp.unpacked.Body.Kbfs.PrivateTeam.Version
}

func (mc *MerkleClient) CanExamineHistoricalRoot(m MetaContext, q keybase1.Seqno) bool {
	chk := mc.FirstExaminableHistoricalRoot(m)
	if chk == nil {
		return true
	}
	return q >= *chk
}
