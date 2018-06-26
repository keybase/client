// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	chat1 "github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
	return FastByteArrayEq(h1[:], h2[:])
}

func (h1 NodeHashShort) String() string {
	return hex.EncodeToString(h1[:])
}

func (h1 NodeHashShort) bytes() []byte {
	return h1[:]
}

func (h1 NodeHashShort) ExportToHashMeta() keybase1.HashMeta {
	return keybase1.HashMeta(h1.bytes())
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

func (h1 NodeHashShort) IsNil() bool {
	return false
}

func (h1 NodeHashLong) Check(s string) bool {
	h2 := sha512.Sum512([]byte(s))
	return FastByteArrayEq(h1[:], h2[:])
}

func hashEq(h1 NodeHash, h2 NodeHash) bool {
	b1 := h1.bytes()
	b2 := h2.bytes()
	return FastByteArrayEq(b1[:], b2[:])
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

	keyring *SpecialKeyRing

	// Blocks that have been verified
	verified map[keybase1.Seqno]bool

	// The most recently-available root
	lastRoot *MerkleRoot

	// The first node we saw that has skip pointers
	firstSkip *MerkleRoot

	// protects whole object
	sync.RWMutex
}

type MerkleRoot struct {
	Contextified
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
		LegacyUIDRoot NodeHashShort  `json:"legacy_uid_root"`
		Prev          NodeHashLong   `json:"prev"`
		Root          NodeHashLong   `json:"root"`
		Seqno         keybase1.Seqno `json:"seqno"`
		Skips         SkipTable      `json:"skips"`
		Txid          string         `json:"txid"`
		Type          string         `json:"type"`
		Version       int            `json:"version"`
		PvlHash       string         `json:"pvl_hash"`
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
	buf := make([]byte, NodeHashLenLong)
	n, err := hex.Decode(buf, []byte(s))
	var ret NodeHash
	if err != nil {
		// Noop
	} else if n == NodeHashLenLong {
		var tmp NodeHashLong
		copy([]byte(tmp[:]), buf)
		ret = tmp
	} else if n == NodeHashLenShort {
		var tmp NodeHashShort
		copy([]byte(tmp[:]), buf)
		ret = tmp
	} else {
		err = fmt.Errorf("Bad NodeHash; wrong length: %d", n)
	}
	return ret, err
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
	if err != nil {
		return err
	}
	err = mc.loadFirstSkip(m)
	return err
}

func merkleHeadKey() DbKey {
	return DbKey{
		Typ: DBLookupMerkleRoot,
		Key: "HEAD",
	}
}

func merkleFirstSkipKey() DbKey {
	return DbKey{
		Typ: DBLookupMerkleRoot,
		Key: "FIRST-SKIP",
	}
}

func (mc *MerkleClient) dbLookup(m MetaContext, k DbKey) (ret *MerkleRoot, err error) {
	defer m.CVTrace(VLog0, fmt.Sprintf("MerkleClient#dbLookup(%+v)", k), func() error { return err })()
	curr, err := m.G().LocalDb.Lookup(k)
	if err != nil {
		return nil, err
	}
	if curr == nil {
		m.VLogf(VLog0, "| MerkleClient#dbLookup(%+v) found not results", k)
		return nil, nil
	}

	mr, err := NewMerkleRootFromJSON(m, curr)
	if err != nil {
		return nil, err
	}
	return mr, err
}

// loadFirstSkip loads the first Merkle block that had full skip pointers. This is
// going to be most useful for development machines. On prod, we'll just hardcode
// the first sequence that has them.
func (mc *MerkleClient) loadFirstSkip(m MetaContext) (err error) {
	if m.G().Env.GetRunMode() == ProductionRunMode {
		return nil
	}
	defer m.CVTrace(VLog0, "MerkleClient#loadFirstSkip()", func() error { return err })()
	var mr *MerkleRoot
	mr, err = mc.dbLookup(m, merkleFirstSkipKey())
	if mr == nil || err != nil {
		return err
	}
	mc.Lock()
	mc.firstSkip = mr
	mc.Unlock()
	return nil
}

func (mc *MerkleClient) loadRoot(m MetaContext) (err error) {
	defer m.CVTrace(VLog0, "MerkleClient#loadRoot()", func() error { return err })()
	var mr *MerkleRoot
	mr, err = mc.dbLookup(m, merkleHeadKey())
	if mr == nil || err != nil {
		return err
	}
	mc.Lock()
	mc.lastRoot = mr
	mc.Unlock()
	return nil
}

func (mr *MerkleRoot) Store(storeFirstSkip bool) error {
	dbKeys := []DbKey{merkleHeadKey()}
	if storeFirstSkip {
		dbKeys = append(dbKeys, merkleFirstSkipKey())
	}

	err := mr.G().LocalDb.Put(DbKey{
		Typ: DBMerkleRoot,
		Key: fmt.Sprintf("%d", mr.Seqno()),
	},
		dbKeys,
		mr.ToJSON(),
	)
	return err
}

func (mr *MerkleRoot) HasSkips() bool {
	return mr.payload.hasSkips()
}

func (mr *MerkleRoot) ToJSON() (jw *jsonw.Wrapper) {
	ret := jsonw.NewDictionary()
	ret.SetKey("sigs", mr.sigs)
	ret.SetKey("payload_json", jsonw.NewString(mr.payload.packed))
	ret.SetKey("fetched_ns", jsonw.NewInt64(mr.fetched.UnixNano()))
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

func NewMerkleRootFromJSON(m MetaContext, jw *jsonw.Wrapper) (ret *MerkleRoot, err error) {
	var sigs *jsonw.Wrapper
	var payloadJSONString string
	var mrp MerkleRootPayload

	if sigs, err = jw.AtKey("sigs").ToDictionary(); err != nil {
		return nil, err
	}

	if payloadJSONString, err = jw.AtKey("payload_json").GetString(); err != nil {
		return nil, err
	}

	if mrp, err = NewMerkleRootPayloadFromJSONString(payloadJSONString); err != nil {
		return nil, err
	}

	ret = &MerkleRoot{
		Contextified: NewContextified(m.G()),
		sigs:         sigs,
		payload:      mrp,
		fetched:      time.Time{},
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
	defer m.CVTrace(VLog0, "MerkleClient#FetchRootFromServerBySeqno", func() error { return err })()
	root := mc.LastRoot()
	if root != nil && *root.Seqno() >= lowerBound {
		m.VLogf(VLog0, "seqno=%d, and was current enough, so returning non-nil previously fetched root", *root.Seqno())
		return root, nil
	}
	return mc.fetchRootFromServer(m, root)
}

func (mc *MerkleClient) FetchRootFromServer(m MetaContext, freshness time.Duration) (mr *MerkleRoot, err error) {
	defer m.CVTrace(VLog0, "MerkleClient#FetchRootFromServer", func() error { return err })()
	root := mc.LastRoot()
	if freshness == 0 && root != nil {
		m.VLogf(VLog0, "freshness=0, returning non-nil previously fetched root")
		return root, nil
	}
	now := m.G().Clock().Now()
	if root != nil && freshness > 0 && now.Sub(root.fetched) < freshness {
		m.VLogf(VLog0, "freshness=%d, and was current enough, so returning non-nil previously fetched root", freshness)
		return root, nil
	}
	return mc.fetchRootFromServer(m, root)
}

func (mc *MerkleClient) fetchRootFromServer(m MetaContext, lastRoot *MerkleRoot) (mr *MerkleRoot, err error) {
	defer m.CVTrace(VLog0, "MerkleClient#fetchRootFromServer", func() error { return err })()
	var ss SkipSequence
	var apiRes *APIRes

	mr, ss, apiRes, err = mc.lookupRootAndSkipSequence(m, lastRoot)
	if err != nil {
		return nil, err
	}
	if err = mc.verifySkipSequenceAndRootThenStore(m, ss, mr, lastRoot, apiRes); err != nil {
		return nil, err
	}
	return mr, nil
}

func (mc *MerkleClient) lookupRootAndSkipSequence(m MetaContext, lastRoot *MerkleRoot) (mr *MerkleRoot, ss SkipSequence, apiRes *APIRes, err error) {
	q := NewHTTPArgs()

	// Get back a series of skips from the last merkle root we had to the new
	// one we're getting back, and hold the server to it.
	lastSeqno := lastRoot.Seqno()
	if lastSeqno != nil {
		q.Add("last", I{int(*lastSeqno)})
	}

	apiRes, err = m.G().API.Get(APIArg{
		Endpoint:       "merkle/root",
		SessionType:    APISessionTypeNONE,
		Args:           q,
		AppStatusCodes: []int{SCOk},
		MetaContext:    m,
	})

	if err != nil {
		return nil, nil, nil, err
	}

	mr, err = readRootFromAPIRes(m, apiRes.Body)
	if err != nil {
		return nil, nil, nil, err
	}
	ss, err = mc.readSkipSequenceFromAPIRes(m, apiRes, mr, lastRoot)
	if err != nil {
		return nil, nil, nil, err
	}
	return mr, ss, apiRes, err
}

func (mc *MerkleClient) lookupPathAndSkipSequenceUser(m MetaContext, q HTTPArgs, sigHints *SigHints, lastRoot *MerkleRoot) (vp *VerificationPath, ss SkipSequence, userInfo *merkleUserInfoT, apiRes *APIRes, err error) {
	apiRes, err = mc.lookupPathAndSkipSequenceHelper(m, q, sigHints, lastRoot, true)
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

func (mc *MerkleClient) lookupPathAndSkipSequenceTeam(m MetaContext, q HTTPArgs, lastRoot *MerkleRoot) (vp *VerificationPath, ss SkipSequence, res *APIRes, err error) {
	apiRes, err := mc.lookupPathAndSkipSequenceHelper(m, q, nil, lastRoot, false)
	if err != nil {
		return nil, nil, nil, err
	}

	vp, err = mc.readPathFromAPIRes(m, apiRes)
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
func (mc *MerkleClient) lookupPathAndSkipSequenceHelper(m MetaContext, q HTTPArgs, sigHints *SigHints, lastRoot *MerkleRoot, isUser bool) (apiRes *APIRes, err error) {
	defer m.CVTrace(VLog0, "MerkleClient#lookupPathAndSkipSequence", func() error { return err })()

	// Poll for 10s and ask for a race-free state.
	w := 10 * int(CITimeMultiplier(mc.G()))

	q.Add("poll", I{w})
	if isUser {
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

	apiRes, err = m.G().API.Get(APIArg{
		Endpoint:       "merkle/path",
		SessionType:    APISessionTypeNONE,
		Args:           q,
		AppStatusCodes: []int{SCOk, SCNotFound, SCDeleted},
		MetaContext:    m,
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

func readRootFromAPIRes(m MetaContext, jw *jsonw.Wrapper) (*MerkleRoot, error) {
	ret, err := NewMerkleRootFromJSON(m, jw)
	if err != nil {
		return nil, err
	}
	ret.fetched = m.G().Clock().Now()
	return ret, nil
}

// readSkipSequenceFromAPIRes returns a SkipSequence. We construct the sequence by starting with the
// most recent merkle root, adding the "skip" pointers returned by the server, and finally bookending
// with the merkle root we last fetched from the DB. In verifySkipSequence, we walk over this Sequence
// to make sure that it obeys proper construction.
func (mc *MerkleClient) readSkipSequenceFromAPIRes(m MetaContext, res *APIRes, thisRoot *MerkleRoot, lastRoot *MerkleRoot) (ret SkipSequence, err error) {
	defer m.CVTrace(VLog0, "MerkleClient#readSkipSequenceFromAPIRes", func() error { return err })()
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
		m.VLogf(VLog0, "| skip list from API server is nil")
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
	vp, err = mc.readPathFromAPIRes(m, res)
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

func (mc *MerkleClient) readPathFromAPIRes(m MetaContext, res *APIRes) (vp *VerificationPath, err error) {
	defer m.CVTrace(VLog0, "MerkleClient#readPathFromAPIRes", func() error { return err })()

	vp = &VerificationPath{
		Contextified: NewContextified(mc.G()),
	}

	vp.root, err = readRootFromAPIRes(m, res.Body.AtKey("root"))
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

func (mc *MerkleClient) LastRoot() *MerkleRoot {
	mc.RLock()
	defer mc.RUnlock()
	if mc.lastRoot == nil {
		return nil
	}
	return mc.lastRoot.ShallowCopy()
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
func (mc *MerkleClient) storeRoot(m MetaContext, root *MerkleRoot, storeFirstSkip bool) {
	m.VLogf(VLog0, "storing merkling root: %d", *root.Seqno())
	err := root.Store(storeFirstSkip)
	if err != nil {
		m.CErrorf("Cannot commit Merkle root to local DB: %s", err)
	} else {
		mc.lastRoot = root
	}
}

func (mc *MerkleClient) FirstSeqnoWithSkips() *keybase1.Seqno {

	if mc.G().Env.GetRunMode() == ProductionRunMode {
		return &FirstProdMerkleSeqnoWithSkips
	}

	mc.RLock()
	defer mc.RUnlock()
	if mc.firstSkip != nil {
		return mc.firstSkip.Seqno()
	}
	return nil
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

func (mc *MerkleClient) verifySkipSequence(m MetaContext, ss SkipSequence, thisRoot *MerkleRoot, lastRoot *MerkleRoot, historical bool) (err error) {
	defer m.CVTrace(VLog0, "MerkleClient#verifySkipSequence", func() error { return err })()

	var left, right keybase1.Seqno
	if thisRoot.Seqno() != nil {
		left = *thisRoot.Seqno()
	}
	if lastRoot.Seqno() != nil {
		right = *lastRoot.Seqno()
	}

	if historical && left < right {
		left, right = right, left
	}

	// In this case, the server did not return a skip sequence. It's OK if
	// the last known root is too old. It's not OK if the last known root is
	// from after the server starting providing skip pointers.
	if ss == nil {
		m.VLogf(VLog0, "| nil SkipSequence")
		fss := mc.FirstSeqnoWithSkips()
		if lastRoot == nil {
			m.VLogf(VLog0, "| lastRoot==nil, so OK")
			return nil
		}
		if fss == nil {
			m.VLogf(VLog0, "| no known root with skips, so OK")
			return nil
		}
		if *fss > right {
			m.VLogf(VLog0, "| right marker (%d) is from before first known root with skips (%d), so OK", int(right), int(*fss))
			return nil
		}
		if *fss > left {
			m.VLogf(VLog0, "| left marker (%d) is from before first known root with skips (%d), so OK", int(left), int(*fss))
			return nil
		}
		if thisRoot != nil && *lastRoot.Seqno() == *thisRoot.Seqno() {
			m.VLogf(VLog0, "| thisRoot is the same as lastRoot (%d), so OK", int(*lastRoot.Seqno()))
			return nil
		}
		return MerkleClientError{fmt.Sprintf("Expected a skip sequence with last=%d", int(*lastRoot.Seqno())), merkleErrorNoSkipSequence}
	}

	if left == right {
		m.VLogf(VLog0, "| No change since last check (seqno %d)", *thisRoot.Seqno())
		return nil
	}
	return ss.verify(m, left, right)
}

// verify verifies the raw "Skip Sequence" ss. ss contains a list of MerkleRootPayloads beginning
// with the most recently returned root, and ending with the last root that we fetched. So for instance,
// it might contain: [ 100, 84, 82, 81 ] in that case that we last fetched Seqno=81 and the server is
// currently at Seqno=100.
func (ss SkipSequence) verify(m MetaContext, thisRoot keybase1.Seqno, lastRoot keybase1.Seqno) (err error) {
	defer m.CVTrace(VLog0, "SkipSequence#verify", func() error { return err })()

	for index := 0; index < len(ss)-1; index++ {
		nextIndex := index + 1
		thisRoot, prevRoot := ss[index].seqno(), ss[nextIndex].seqno()
		m.VLogf(VLog0, "| Checking skip %d->%d", thisRoot, prevRoot)

		// First check that the merkle Seqno sequence is strictly decreasing
		if thisRoot <= prevRoot {
			return MerkleClientError{fmt.Sprintf("Sequence error: %d <= %d", thisRoot, prevRoot), merkleErrorSkipSequence}
		}

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
	}

	// Enforce the invariant that the most recently published merkle root and the last gotten
	// merkle root are the bookends of the sequence.  we should have set up datastructures
	// previously so this is the case
	if thisRoot != ss[0].seqno() {
		return MerkleClientError{fmt.Sprintf("expected the left bookend of the SkipSequence to be this root, but %d != %d", thisRoot, ss[0].seqno()), merkleErrorNoLeftBookend}
	}
	if lastRoot != ss[len(ss)-1].seqno() {
		return MerkleClientError{fmt.Sprintf("expected the right bookend of the SkipSequence to be last root, but %d != %d", thisRoot, ss[len(ss)-1].seqno()), merkleErrorNoRightBookend}
	}

	return nil
}

func (mc *MerkleClient) verifyAndStoreRoot(m MetaContext, root *MerkleRoot, seqnoWhenCalled *keybase1.Seqno) error {
	return mc.verifyAndStoreRootHelper(m, root, seqnoWhenCalled, false)
}

func (mc *MerkleClient) verifyAndStoreRootHelper(m MetaContext, root *MerkleRoot, seqnoWhenCalled *keybase1.Seqno, historical bool) (err error) {
	defer m.CVTrace(VLog0, fmt.Sprintf("merkleClient#verifyAndStoreRootHelper(root=%d, cached=%v, historical=%v)", int(*root.Seqno()), seqnoWhenCalled, historical), func() error { return err })()

	// First make sure it's not a rollback. If we're doing an historical lookup, it's
	// actual OK.
	if !historical && seqnoWhenCalled != nil && *seqnoWhenCalled > *root.Seqno() {
		return fmt.Errorf("Server rolled back Merkle tree: %d > %d", *seqnoWhenCalled, *root.Seqno())
	}

	mc.Lock()
	defer mc.Unlock()

	// Maybe we've already verified it before.
	verified, found := mc.verified[*root.Seqno()]
	if verified && found && !historical {
		mc.storeRoot(m, root, false)
		return nil
	}

	kid, sig, err := mc.findValidKIDAndSig(root)
	if err != nil {
		return err
	}
	m.VLogf(VLog0, "+ Merkle: using KID=%s for verifying server sig", kid)

	key, err := mc.keyring.Load(kid)
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

	m.VLogf(VLog0, "- Merkle: server sig verified")

	mc.verified[*root.Seqno()] = true

	newFirstSkip := false
	if mc.firstSkip == nil && root.HasSkips() && mc.G().Env.GetRunMode() != ProductionRunMode {
		mc.firstSkip = root
		newFirstSkip = true
	}

	if !historical {
		mc.storeRoot(m, root, newFirstSkip)
	}

	return nil
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
	m.VLogf(VLog0, "+ ParsingMerkleUserLeaf")

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

	m.VLogf(VLog0, "- ParsingMerkleUserLeaf -> %v", ErrToOk(err))
	return
}

func parseMerkleTeamLeaf(m MetaContext, jw *jsonw.Wrapper, g *GlobalContext) (leaf *MerkleTeamLeaf, err error) {
	m.VLogf(VLog0, "+ ParsingMerkleUserLeaf")

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

	m.VLogf(VLog0, "- ParsingMerkleUserLeaf -> %v", ErrToOk(err))
	return &MerkleTeamLeaf{
		// TeamID is filled in by the caller
		Public:  public,
		Private: private,
	}, err
}

func (vp *VerificationPath) verifyUsername(m MetaContext, userInfo merkleUserInfoT) (username string, err error) {
	if CheckUIDAgainstUsername(userInfo.uid, userInfo.username) == nil {
		m.VLogf(VLog0, "| Username %s mapped to %s via direct hash", userInfo.username, userInfo.uid)
		username = userInfo.username
		return
	}

	m.VLogf(VLog0, "| Failed to map Username %s -> UID %s via direct hash", userInfo.username, userInfo.uid)

	if userInfo.usernameCased != userInfo.username && strings.ToLower(userInfo.usernameCased) == userInfo.username {
		m.VLogf(VLog0, "| Checking cased username difference: %s v %s", userInfo.username, userInfo.usernameCased)
		if CheckUIDAgainstCasedUsername(userInfo.uid, userInfo.usernameCased) == nil {
			m.VLogf(VLog0, "| Username %s mapped to %s via direct hash (w/ username casing)", userInfo.usernameCased, userInfo.uid)
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

	m.VLogf(VLog0, "| Username %s mapped to %s via Merkle lookup", userInfo.username, userInfo.uid)
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

func (mc *MerkleClient) verifySkipSequenceAndRootHistorical(m MetaContext, ss SkipSequence, curr *MerkleRoot, prev *MerkleRoot, apiRes *APIRes) (err error) {
	return mc.verifySkipSequenceAndRootHelper(m, ss, curr, prev, apiRes, true)
}

func (mc *MerkleClient) verifySkipSequenceAndRootThenStore(m MetaContext, ss SkipSequence, curr *MerkleRoot, prev *MerkleRoot, apiRes *APIRes) (err error) {
	return mc.verifySkipSequenceAndRootHelper(m, ss, curr, prev, apiRes, false)
}

func (mc *MerkleClient) verifySkipSequenceAndRootHelper(m MetaContext, ss SkipSequence, curr *MerkleRoot, prev *MerkleRoot, apiRes *APIRes, historical bool) (err error) {

	defer func() {
		if err != nil {
			m.VLogf(VLog0, "| Full APIRes was: %s", apiRes.Body.MarshalToDebug())
		}
	}()

	// It's important to check the merkle skip sequence before verifying the root.
	// If it's historical, then it's OK to swap ordering directions.
	if err = mc.verifySkipSequence(m, ss, curr, prev, historical); err != nil {
		return err
	}
	return mc.verifyAndStoreRootHelper(m, curr, prev.Seqno(), historical)
}

func (mc *MerkleClient) LookupUser(m MetaContext, q HTTPArgs, sigHints *SigHints) (u *MerkleUserLeaf, err error) {

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
	rootBeforeCall := mc.LastRoot()

	path, ss, userInfo, apiRes, err := mc.lookupPathAndSkipSequenceUser(m, q, sigHints, rootBeforeCall)
	if err != nil {
		return nil, err
	}
	// spot check that the user-specific path attributes were filled
	if userInfo.uid.IsNil() {
		return nil, fmt.Errorf("verification path has nil UID")
	}

	if err = mc.verifySkipSequenceAndRootThenStore(m, ss, path.root, rootBeforeCall, apiRes); err != nil {
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
	leaf, _, err = mc.lookupLeafHistorical(m, leafID, paramer, checker)
	return leaf, err
}

func (mc *MerkleClient) checkHistoricalSeqno(s keybase1.Seqno) error {
	if mc.G().Env.GetRunMode() == ProductionRunMode && s < FirstProdMerkleSeqnoWithSigs {
		return MerkleClientError{fmt.Sprintf("cannot load seqno=%d; must load at %d or higher", s, FirstProdMerkleSeqnoWithSigs), merkleErrorAncientSeqno}
	}
	return nil
}

func (mc *MerkleClient) LookupLeafAtSeqno(m MetaContext, leafID keybase1.UserOrTeamID, s keybase1.Seqno) (leaf *MerkleGenericLeaf, root *MerkleRoot, err error) {
	m.VLogf(VLog0, "+ MerkleClient.LookupLeafAtHashMeta(%v)", leafID)
	if err = mc.checkHistoricalSeqno(s); err != nil {
		return nil, nil, err
	}
	paramer := func(a *HTTPArgs) {
		a.Add("start_seqno", I{Val: int(s)})
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
	return mc.lookupLeafHistorical(m, leafID, paramer, checker)
}

func (mc *MerkleClient) LookupRootAtSeqno(m MetaContext, s keybase1.Seqno) (root *MerkleRoot, err error) {
	defer m.CVTrace(VLog0, fmt.Sprintf("LookupRootAtSeqno(%d)", s), func() error { return err })()
	_, root, err = mc.LookupLeafAtSeqno(m, keybase1.UserOrTeamID(""), s)
	return root, err
}

func (mc *MerkleClient) lookupLeafHistorical(m MetaContext, leafID keybase1.UserOrTeamID, paramer func(*HTTPArgs), checker func(*VerificationPath) error) (leaf *MerkleGenericLeaf, root *MerkleRoot, err error) {

	var path *VerificationPath
	var ss SkipSequence
	var apiRes *APIRes

	if err = mc.init(m); err != nil {
		return nil, nil, err
	}

	// The must current root we got. This might be slightly out of date, but all we really care
	// is that it points back to another historical root. It's also possible for the root we're
	// going to get back to be ahead of where we are, so we have to be resilient to both cases.
	currentRoot := mc.LastRoot()

	q := NewHTTPArgs()
	if leafID.IsNil() {
		q.Add("no_leaf", B{Val: true})
	} else {
		q.Add("leaf_id", S{Val: leafID.String()})
	}
	paramer(&q)

	if path, ss, apiRes, err = mc.lookupPathAndSkipSequenceTeam(m, q, currentRoot); err != nil {
		return nil, nil, err
	}

	if err = checker(path); err != nil {
		return nil, nil, err
	}

	err = mc.verifySkipSequenceAndRootHistorical(m, ss, path.root, currentRoot, apiRes)
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

func (mc *MerkleClient) LookupTeam(m MetaContext, teamID keybase1.TeamID) (leaf *MerkleTeamLeaf, err error) {
	// Copied from LookupUser. These methods should be kept relatively in sync.

	m.VLogf(VLog0, "+ MerkleClient.LookupTeam(%v)", teamID)

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
	rootBeforeCall := mc.LastRoot()

	q := NewHTTPArgs()
	q.Add("leaf_id", S{Val: teamID.String()})

	if path, ss, apiRes, err = mc.lookupPathAndSkipSequenceTeam(m, q, rootBeforeCall); err != nil {
		return nil, err
	}

	if err = mc.verifySkipSequenceAndRootThenStore(m, ss, path.root, rootBeforeCall, apiRes); err != nil {
		return nil, err
	}

	if leaf, err = path.verifyTeam(m, teamID); err != nil {
		return nil, err
	}

	m.VLogf(VLog0, "- MerkleClient.LookupTeam(%v) -> OK", teamID)
	return leaf, nil
}

func (mr *MerkleRoot) ToSigJSON() (ret *jsonw.Wrapper) {

	ret = jsonw.NewDictionary()
	ret.SetKey("seqno", jsonw.NewInt(int(*mr.Seqno())))
	ret.SetKey("ctime", jsonw.NewInt64(int64(mr.Ctime())))
	ret.SetKey("hash", jsonw.NewString(mr.RootHash().String()))
	ret.SetKey("hash_meta", jsonw.NewString(mr.ShortHash().String()))

	return
}

func (mr *MerkleRoot) ToInfo() chat1.MerkleRoot {
	return chat1.MerkleRoot{
		Seqno: int64(*mr.Seqno()),
		Hash:  mr.RootHash().bytes(),
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

// Can return (nil, nil) if no root is known.
func (mc *MerkleClient) LastRootInfo(m MetaContext) (*chat1.MerkleRoot, error) {
	// Lazy-init, only when needed.
	err := mc.init(m)
	if err != nil {
		return nil, err
	}
	mc.RLock()
	defer mc.RUnlock()
	if mc.lastRoot == nil {
		return nil, nil
	}
	mi := mc.lastRoot.ToInfo()
	return &mi, nil
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
