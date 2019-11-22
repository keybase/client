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

type MerkleClient struct {
	Contextified

	// protects whole object
	sync.RWMutex

	keyring *SpecialKeyRing

	// Blocks that have been verified
	verified map[keybase1.Seqno]bool

	// The most recently-available root
	lastRoot *MerkleRoot

	// The first node we saw that has skip pointers; not used in production
	firstSkip *keybase1.Seqno

	// Protects multiple clients calling freshness-based fetches concurrently
	// and all missing.
	freshLock sync.Mutex
}

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
	Seqno  keybase1.Seqno `json:"seqno"`
	LinkID LinkID         `json:"id"`
	SigID  keybase1.SigID `json:"sigid,omitempty"`
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
	tab := mrp.unpacked.Body.Skips
	return tab != nil && len(tab) > 0
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
		LegacyUIDRoot     NodeHashShort  `json:"legacy_uid_root"`
		Prev              NodeHashLong   `json:"prev"`
		Root              NodeHashLong   `json:"root"`
		Seqno             keybase1.Seqno `json:"seqno"`
		Skips             SkipTable      `json:"skips"`
		Txid              string         `json:"txid"`
		Type              string         `json:"type"`
		Version           int            `json:"version"`
		PvlHash           string         `json:"pvl_hash"`
		ProofServicesHash string         `json:"proof_services_hash"`
		ExternalURLHash   string         `json:"external_urls_hash"`
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
	return mt.Seqno == mt2.Seqno && mt.LinkID.Eq(mt2.LinkID) && mt.SigID.Equal(mt2.SigID)
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

func computeLogPatternMerkleSkips(startSeqno keybase1.Seqno, endSeqno keybase1.Seqno) []uint {
	end := uint(endSeqno)
	var ret []uint
	diff := end - uint(startSeqno)
	if diff <= 0 {
		return ret
	}
	skips := computeSetBitsBigEndian(diff)
	curr := end
	// Ignore first set bit
	for i := len(skips) - 1; i > 0; i-- {
		curr -= skips[i]
		ret = append(ret, curr)
	}
	return ret
}

func NewMerkleClient(g *GlobalContext) *MerkleClient {
	return &MerkleClient{
		keyring:      NewSpecialKeyRing(g.Env.GetMerkleKIDs(), g),
		verified:     make(map[keybase1.Seqno]bool),
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
	defer m.VTrace(VLog1, fmt.Sprintf("MerkleClient#dbGet(%+v)", k), func() error { return err })()
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
	defer m.VTrace(VLog1, "MerkleClient#loadRoot()", func() error { return err })()
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

func (mc *MerkleClient) FetchRootFromServerBySeqno(m MetaContext, lowerBound keybase1.Seqno) (mr *MerkleRoot, err error) {
	defer m.VTrace(VLog0, "MerkleClient#FetchRootFromServerBySeqno", func() error { return err })()
	root := mc.LastRoot(m)
	if root != nil && *root.Seqno() >= lowerBound {
		m.VLogf(VLog0, "seqno=%d, and was current enough, so returning non-nil previously fetched root", *root.Seqno())
		return root, nil
	}
	return mc.fetchRootFromServer(m, root)
}

// FetchRootFromServer fetches a root from the server. If the last-fetched root was fetched within
// freshness ago, then OK to return the last-fetched root. Otherwise refetch. Similarly, if the freshness
// passed is 0, then always refresh.
func (mc *MerkleClient) FetchRootFromServer(m MetaContext, freshness time.Duration) (mr *MerkleRoot, err error) {
	defer m.VTrace(VLog0, "MerkleClient#FetchRootFromServer", func() error { return err })()

	// on startup, many threads might try to mash this call at once (via the Auditor or
	// other pathways). So protect this with a lock.
	mc.freshLock.Lock()
	defer mc.freshLock.Unlock()

	root := mc.LastRoot(m)
	now := m.G().Clock().Now()
	if root != nil && freshness > 0 && now.Sub(root.fetched) < freshness {
		m.VLogf(VLog0, "freshness=%d, and was current enough, so returning non-nil previously fetched root", freshness)
		return root, nil
	}
	return mc.fetchRootFromServer(m, root)
}

func (mc *MerkleClient) fetchRootFromServer(m MetaContext, lastRoot *MerkleRoot) (mr *MerkleRoot, err error) {
	defer m.VTrace(VLog0, "MerkleClient#fetchRootFromServer", func() error { return err })()
	var ss SkipSequence
	var apiRes *APIRes
	var opts MerkleOpts

	mr, ss, apiRes, err = mc.lookupRootAndSkipSequence(m, lastRoot, opts)
	if err != nil {
		return nil, err
	}
	if err = mc.verifySkipSequenceAndRoot(m, ss, mr, lastRoot, apiRes, opts); err != nil {
		return nil, err
	}
	return mr, nil
}

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

func (mc *MerkleClient) lookupPathAndSkipSequenceUser(m MetaContext, q HTTPArgs, sigHints *SigHints, lastRoot *MerkleRoot, opts MerkleOpts) (vp *VerificationPath, ss SkipSequence, userInfo *merkleUserInfoT, apiRes *APIRes, err error) {
	opts.isUser = true
	apiRes, err = mc.lookupPathAndSkipSequenceHelper(m, q, sigHints, lastRoot, opts)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	if sigHints != nil {
		if err = sigHints.RefreshWith(m, apiRes.Body.AtKey("sigs")); err != nil {
			return nil, nil, nil, nil, err
		}
	}

	vp, userInfo, err = mc.readPathFromAPIResUser(m, apiRes)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	ss, err = mc.readSkipSequenceFromAPIRes(m, apiRes, vp.root, lastRoot)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	return vp, ss, userInfo, apiRes, nil
}

func (mc *MerkleClient) lookupPathAndSkipSequenceTeam(m MetaContext, q HTTPArgs, lastRoot *MerkleRoot, opts MerkleOpts) (vp *VerificationPath, ss SkipSequence, res *APIRes, err error) {
	apiRes, err := mc.lookupPathAndSkipSequenceHelper(m, q, nil, lastRoot, opts)
	if err != nil {
		return nil, nil, nil, err
	}

	vp, err = mc.readPathFromAPIRes(m, apiRes, opts)
	if err != nil {
		return nil, nil, nil, err
	}

	ss, err = mc.readSkipSequenceFromAPIRes(m, apiRes, vp.root, lastRoot)
	if err != nil {
		return nil, nil, nil, err
	}

	return vp, ss, apiRes, nil
}

// `isUser` is true for loading a user and false for loading a team.
func (mc *MerkleClient) lookupPathAndSkipSequenceHelper(m MetaContext, q HTTPArgs, sigHints *SigHints, lastRoot *MerkleRoot, opts MerkleOpts) (apiRes *APIRes, err error) {
	defer m.VTrace(VLog1, "MerkleClient#lookupPathAndSkipSequence", func() error { return err })()

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

	// Get back a series of skips from the last merkle root we had to the new
	// one we're getting back, and hold the server to it.
	lastSeqno := lastRoot.Seqno()
	if lastSeqno != nil {
		q.Add("last", I{int(*lastSeqno)})
	}

	apiRes, err = m.G().API.Get(m, APIArg{
		Endpoint:        "merkle/path",
		SessionType:     APISessionTypeOPTIONAL,
		Args:            q,
		AppStatusCodes:  []int{SCOk, SCNotFound, SCDeleted},
		RetryCount:      3,
		InitialTimeout:  4 * time.Second,
		RetryMultiplier: 1.1,
	})

	if err != nil {
		return nil, err
	}
	switch apiRes.AppStatus.Code {
	case SCNotFound:
		err = NotFoundError{}
		return nil, err
	case SCDeleted:
		err = UserDeletedError{}
		return nil, err
	}

	return apiRes, err
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
	defer m.VTrace(VLog1, "MerkleClient#readSkipSequenceFromAPIRes", func() error { return err })()
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

func (mc *MerkleClient) readPathFromAPIResUser(m MetaContext, res *APIRes) (vp *VerificationPath, userInfo *merkleUserInfoT, err error) {
	vp, err = mc.readPathFromAPIRes(m, res, MerkleOpts{})
	if err != nil {
		return nil, nil, err
	}

	userInfo = &merkleUserInfoT{}

	userInfo.uid, err = GetUID(res.Body.AtKey("uid"))
	if err != nil {
		return nil, nil, err
	}

	// We don't trust this version, but it's useful to tell us if there
	// are new versions unsigned data, like basics, and maybe uploaded
	// keys
	userInfo.idVersion, err = res.Body.AtKey("id_version").GetInt64()
	if err != nil {
		return nil, nil, err
	}

	userInfo.uidPath, err = importPathFromJSON(res.Body.AtKey("uid_proof_path"))
	if err != nil {
		return nil, nil, err
	}

	userInfo.username, err = res.Body.AtKey("username").GetString()
	if err != nil {
		return nil, nil, err
	}
	userInfo.usernameCased, _ = res.Body.AtKey("username_cased").GetString()

	userInfo.unverifiedResetChain, err = importResetChainFromServer(m, res.Body.AtKey("reset_chain"))
	if err != nil {
		return nil, nil, err
	}

	return vp, userInfo, nil
}

func (mc *MerkleClient) readPathFromAPIRes(m MetaContext, res *APIRes, opts MerkleOpts) (vp *VerificationPath, err error) {
	defer m.VTrace(VLog1, "MerkleClient#readPathFromAPIRes", func() error { return err })()

	vp = &VerificationPath{
		Contextified: NewContextified(mc.G()),
	}

	vp.root, err = readRootFromAPIRes(m, res.Body.AtKey("root"), opts)
	if err != nil {
		return nil, err
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
	defer m.VTrace(VLog1, "MerkleClient#verifySkipSequence", func() error { return err })()

	var left, right keybase1.Seqno
	if thisRoot.Seqno() != nil {
		left = *thisRoot.Seqno()
	}
	if lastRoot.Seqno() != nil {
		right = *lastRoot.Seqno()
	}

	if opts.historical && left < right {
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
	defer m.VTrace(VLog1, "SkipSequence#verify", func() error { return err })()

	expectedSkips := computeLogPatternMerkleSkips(lastRoot, thisRoot)
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

func (mc *MerkleClient) verifyAndStoreRootHelper(m MetaContext, root *MerkleRoot, seqnoWhenCalled *keybase1.Seqno, opts MerkleOpts) (err error) {
	defer m.VTrace(VLog1, fmt.Sprintf("merkleClient#verifyAndStoreRootHelper(root=%d, cached=%v, opts=%+v)", int(*root.Seqno()), seqnoWhenCalled, opts), func() error { return err })()

	// First make sure it's not a rollback. If we're doing an historical lookup, it's
	// actual OK.
	if !opts.historical && seqnoWhenCalled != nil && *seqnoWhenCalled > *root.Seqno() {
		return fmt.Errorf("Server rolled back Merkle tree: %d > %d", *seqnoWhenCalled, *root.Seqno())
	}

	mc.Lock()
	defer mc.Unlock()

	// Maybe we've already verified it before.
	verified, found := mc.verified[*root.Seqno()]
	if verified && found && !opts.historical {
		mc.storeRoot(m, root)
		return nil
	}

	kid, sig, err := mc.findValidKIDAndSig(root)
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
	_, err = key.VerifyString(mc.G().Log, sig, []byte(root.payload.packed))
	if err != nil {
		return err
	}

	skips := root.payload.unpacked.Body.Skips
	if err := verifyRootSkips(*root.Seqno(), skips); err != nil {
		return err
	}

	m.VLogf(VLog1, "- Merkle: server sig verified")

	mc.verified[*root.Seqno()] = true

	if !opts.historical {
		mc.storeRoot(m, root)
	}

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

	var si keybase1.SigID
	if l == 3 {
		si, err = GetSigID(jw.AtIndex(2), false)
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
	// If it's historical, then it's OK to swap ordering directions.
	if err = mc.verifySkipSequence(m, ss, curr, prev, opts); err != nil {
		return err
	}
	if opts.noSigCheck {
		m.VLogf(VLog0, "| noSigCheck wanted, so skipping out")
		return nil
	}
	return mc.verifyAndStoreRootHelper(m, curr, prev.Seqno(), opts)
}

func (mc *MerkleClient) LookupUser(m MetaContext, q HTTPArgs, sigHints *SigHints, opts MerkleOpts) (u *MerkleUserLeaf, err error) {

	m.VLogf(VLog0, "+ MerkleClient.LookupUser(%v)", q)

	var path *VerificationPath
	var ss SkipSequence
	var apiRes *APIRes

	if err = mc.init(m); err != nil {
		return nil, err
	}

	// Grab the cached seqno before the call to get the next one is made.
	// Note, we can have multiple concurrent calls to LookupUser that can return in any order.
	// Checking against the cache after the call completes can cause false-positive rollback
	// warnings if the first call is super slow, and the second call is super fast, and there
	// was a change on the server side. See CORE-4064.
	rootBeforeCall := mc.LastRoot(m)

	path, ss, userInfo, apiRes, err := mc.lookupPathAndSkipSequenceUser(m, q, sigHints, rootBeforeCall, opts)
	if err != nil {
		return nil, err
	}
	// spot check that the user-specific path attributes were filled
	if userInfo.uid.IsNil() {
		return nil, fmt.Errorf("verification path has nil UID")
	}

	if err = mc.verifySkipSequenceAndRoot(m, ss, path.root, rootBeforeCall, apiRes, opts); err != nil {
		return nil, err
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
	leaf, _, err = mc.lookupLeafHistorical(m, leafID, paramer, checker, MerkleOpts{})
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
	return mc.lookupLeafAtSeqno(m, leafID, s, MerkleOpts{})
}

func (mc *MerkleClient) LookupLeafAtSeqnoForAudit(m MetaContext, leafID keybase1.UserOrTeamID, s keybase1.Seqno) (leaf *MerkleGenericLeaf, root *MerkleRoot, err error) {
	return mc.lookupLeafAtSeqno(m, leafID, s, MerkleOpts{noSigCheck: true})
}

func (mc *MerkleClient) lookupLeafAtSeqno(m MetaContext, leafID keybase1.UserOrTeamID, s keybase1.Seqno, opts MerkleOpts) (leaf *MerkleGenericLeaf, root *MerkleRoot, err error) {
	m.VLogf(VLog0, "+ MerkleClient.lookupLeafAtSeqno(%v,%v,%v)", leafID, s, opts)
	if err = mc.checkHistoricalSeqno(s); err != nil {
		return nil, nil, err
	}
	paramer := func(a *HTTPArgs) {
		a.Add("start_seqno", I{Val: int(s)})
		if opts.noSigCheck {
			a.Add("no_root_sigs", B{Val: true})
		}
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
	return mc.lookupLeafHistorical(m, leafID, paramer, checker, opts)
}

func (mc *MerkleClient) LookupRootAtSeqno(m MetaContext, s keybase1.Seqno) (root *MerkleRoot, err error) {
	defer m.VTrace(VLog0, fmt.Sprintf("LookupRootAtSeqno(%d)", s), func() error { return err })()
	_, root, err = mc.LookupLeafAtSeqno(m, keybase1.UserOrTeamID(""), s)
	return root, err
}

func (mc *MerkleClient) lookupLeafHistorical(m MetaContext, leafID keybase1.UserOrTeamID, paramer func(*HTTPArgs), checker func(*VerificationPath) error, opts MerkleOpts) (leaf *MerkleGenericLeaf, root *MerkleRoot, err error) {

	var path *VerificationPath
	var ss SkipSequence
	var apiRes *APIRes

	if err = mc.init(m); err != nil {
		return nil, nil, err
	}

	// The must current root we got. This might be slightly out of date, but all we really care
	// is that it points back to another historical root. It's also possible for the root we're
	// going to get back to be ahead of where we are, so we have to be resilient to both cases.
	currentRoot := mc.LastRoot(m)

	q := NewHTTPArgs()
	if leafID.IsNil() {
		q.Add("no_leaf", B{Val: true})
	} else {
		q.Add("leaf_id", S{Val: leafID.String()})
	}
	paramer(&q)

	if path, ss, apiRes, err = mc.lookupPathAndSkipSequenceTeam(m, q, currentRoot, opts); err != nil {
		return nil, nil, err
	}

	if err = checker(path); err != nil {
		return nil, nil, err
	}

	opts.historical = true
	err = mc.verifySkipSequenceAndRoot(m, ss, path.root, currentRoot, apiRes, opts)
	if err != nil {
		return nil, nil, err
	}

	if !leafID.IsNil() {
		leaf, err = path.verifyUserOrTeam(m, leafID)
		if err != nil {
			return nil, nil, err
		}
	}

	return leaf, path.root, nil
}

func (mc *MerkleClient) LookupTeamWithHidden(m MetaContext, teamID keybase1.TeamID,
	processHiddenResponseFunc func(m MetaContext, teamID keybase1.TeamID, apiRes *APIRes, blindRootHash []byte) (*MerkleHiddenResponse, error)) (leaf *MerkleTeamLeaf, hiddenResp *MerkleHiddenResponse, err error) {
	// Copied from LookupUser. These methods should be kept relatively in sync.
	return mc.lookupTeam(m, teamID, processHiddenResponseFunc)
}

func (mc *MerkleClient) LookupTeam(m MetaContext, teamID keybase1.TeamID) (leaf *MerkleTeamLeaf, err error) {
	// Copied from LookupUser. These methods should be kept relatively in sync.
	leaf, _, err = mc.lookupTeam(m, teamID, nil)
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

	// Type used to skip all hidden checks as feature flags is off
	MerkleHiddenResponseTypeFLAGOFF MerkleHiddenResponseType = 127
)

type MerkleHiddenResponse struct {
	RespType            MerkleHiddenResponseType `json:"resp_type"`
	CommittedHiddenTail *sig3.Tail               `json:"committed_hidden_tail"`
	UncommittedSeqno    keybase1.Seqno           `json:"uncommitted_seqno"`
}

func (mc *MerkleClient) lookupTeam(m MetaContext, teamID keybase1.TeamID, processHiddenResponseFunc func(m MetaContext, teamID keybase1.TeamID, apiRes *APIRes, blindRootHash []byte) (*MerkleHiddenResponse, error)) (leaf *MerkleTeamLeaf, hiddenResp *MerkleHiddenResponse, err error) {

	m.VLogf(VLog0, "+ MerkleClient.LookupTeam(%v)", teamID)

	var path *VerificationPath
	var ss SkipSequence
	var apiRes *APIRes
	var opts MerkleOpts

	if err = mc.init(m); err != nil {
		return nil, nil, err
	}

	// Grab the cached seqno before the call to get the next one is made.
	// Note, we can have multiple concurrent calls to LookupUser that can return in any order.
	// Checking against the cache after the call completes can cause false-positive rollback
	// warnings if the first call is super slow, and the second call is super fast, and there
	// was a change on the server side. See CORE-4064.
	rootBeforeCall := mc.LastRoot(m)

	q := NewHTTPArgs()
	q.Add("leaf_id", S{Val: teamID.String()})

	if path, ss, apiRes, err = mc.lookupPathAndSkipSequenceTeam(m, q, rootBeforeCall, opts); err != nil {
		return nil, nil, err
	}

	if err = mc.verifySkipSequenceAndRoot(m, ss, path.root, rootBeforeCall, apiRes, opts); err != nil {
		return nil, nil, err
	}

	if leaf, err = path.verifyTeam(m, teamID); err != nil {
		return nil, nil, err
	}

	if processHiddenResponseFunc != nil {
		hiddenResp, err = processHiddenResponseFunc(m, teamID, apiRes, []byte{})
		if err != nil {
			return nil, nil, err
		}
	}

	m.VLogf(VLog0, "- MerkleClient.LookupTeam(%v) -> OK", teamID)
	return leaf, hiddenResp, err
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
func (mrp MerkleRootPayload) ctime() int64                { return mrp.unpacked.Ctime }
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
