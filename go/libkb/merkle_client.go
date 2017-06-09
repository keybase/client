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
	"golang.org/x/net/context"
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
// both, and just to unmarshal into the relevant relevant field. Note this
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
}

type PathSteps []*PathStep

type VerificationPath struct {
	Contextified
	uid           keybase1.UID
	root          *MerkleRoot
	path          PathSteps
	uidPath       PathSteps
	idVersion     int64
	username      string
	usernameCased string
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
				Root    *string `json:"root"`
				Version *int    `json:"version"`
			} `json:"private"`
			Public struct {
				Root    *string `json:"root"`
				Version *int    `json:"version"`
			} `json:"public"`
		} `json:"kbfs"`
		Key struct {
			Fingerprint PGPFingerprint `json:"fingerprint"`
			KeyID       string         `json:"key_id"`
		} `json:"key"`
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

func (mc *MerkleClient) init(ctx context.Context) error {
	err := mc.loadRoot(ctx)
	if err != nil {
		return err
	}
	err = mc.loadFirstSkip(ctx)
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

func (mc *MerkleClient) dbLookup(ctx context.Context, k DbKey) (ret *MerkleRoot, err error) {
	defer mc.G().CTrace(ctx, fmt.Sprintf("MerkleClient#dbLookup(%+v)", k), func() error { return err })()
	curr, err := mc.G().LocalDb.Lookup(k)
	if err != nil {
		return nil, err
	}
	if curr == nil {
		mc.G().Log.CDebugf(ctx, "| MerkleClient#dbLookup(%+v) found not results", k)
		return nil, nil
	}

	mr, err := NewMerkleRootFromJSON(curr, mc.G())
	if err != nil {
		return nil, err
	}
	return mr, err
}

// loadFirstSkip loads the first Merkle block that had full skip pointers. This is
// going to be most useful for development machines. On prod, we'll just hardcode
// the first sequence that has them.
func (mc *MerkleClient) loadFirstSkip(ctx context.Context) (err error) {
	if mc.G().Env.GetRunMode() == ProductionRunMode {
		return nil
	}
	defer mc.G().CTrace(ctx, "MerkleClient#loadFirstSkip()", func() error { return err })()
	var mr *MerkleRoot
	mr, err = mc.dbLookup(ctx, merkleFirstSkipKey())
	if mr == nil || err != nil {
		return err
	}
	mc.Lock()
	mc.firstSkip = mr
	mc.Unlock()
	return nil
}

func (mc *MerkleClient) loadRoot(ctx context.Context) (err error) {
	defer mc.G().CTrace(ctx, "MerkleClient#loadRoot()", func() error { return err })()
	var mr *MerkleRoot
	mr, err = mc.dbLookup(ctx, merkleHeadKey())
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

func NewMerkleRootFromJSON(jw *jsonw.Wrapper, g *GlobalContext) (ret *MerkleRoot, err error) {
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
		Contextified: NewContextified(g),
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

func (mc *MerkleClient) FetchRootFromServer(ctx context.Context, freshness time.Duration) (mr *MerkleRoot, err error) {
	defer mc.G().CTrace(ctx, "MerkleClient#FetchRootFromServer", func() error { return err })()
	root := mc.LastRoot()
	if freshness == 0 && root != nil {
		mc.G().Log.CDebugf(ctx, "freshness=0, returning non-nil previously fetched root")
		return root, nil
	}
	now := mc.G().Clock().Now()
	if root != nil && freshness > 0 && now.Sub(root.fetched) < freshness {
		mc.G().Log.CDebugf(ctx, "freshness=%d, and was current enough, so returning non-nil previously fetched root", freshness)
		return root, nil
	}
	return mc.fetchRootFromServer(ctx, root)
}

func (mc *MerkleClient) fetchRootFromServer(ctx context.Context, lastRoot *MerkleRoot) (mr *MerkleRoot, err error) {
	defer mc.G().CTrace(ctx, "MerkleClient#fetchRootFromServer", func() error { return err })()
	var ss SkipSequence
	var apiRes *APIRes

	mr, ss, apiRes, err = mc.lookupRootAndSkipSequence(ctx, lastRoot)
	if err != nil {
		return nil, err
	}
	if err = mc.verifySkipSequenceAndRootThenStore(ctx, ss, mr, lastRoot, apiRes); err != nil {
		return nil, err
	}
	return mr, nil
}

func (mc *MerkleClient) lookupRootAndSkipSequence(ctx context.Context, lastRoot *MerkleRoot) (mr *MerkleRoot, ss SkipSequence, apiRes *APIRes, err error) {
	q := NewHTTPArgs()

	// Get back a series of skips from the last merkle root we had to the new
	// one we're getting back, and hold the server to it.
	lastSeqno := lastRoot.Seqno()
	if lastSeqno != nil {
		q.Add("last", I{int(*lastSeqno)})
	}

	apiRes, err = mc.G().API.Get(APIArg{
		Endpoint:       "merkle/root",
		SessionType:    APISessionTypeNONE,
		Args:           q,
		AppStatusCodes: []int{SCOk},
		NetContext:     ctx,
	})

	if err != nil {
		return nil, nil, nil, err
	}

	mr, err = readRootFromAPIRes(mc.G(), apiRes.Body)
	if err != nil {
		return nil, nil, nil, err
	}
	ss, err = mc.readSkipSequenceFromAPIRes(ctx, apiRes, mr, lastRoot)
	if err != nil {
		return nil, nil, nil, err
	}
	return mr, ss, apiRes, err
}

func (mc *MerkleClient) lookupPathAndSkipSequence(ctx context.Context, q HTTPArgs, sigHints *SigHints, lastRoot *MerkleRoot) (vp *VerificationPath, ss SkipSequence, res *APIRes, err error) {
	defer mc.G().CTrace(ctx, "MerkleClient#lookupPathAndSkipSequence", func() error { return err })()

	// Poll for 10s and ask for a race-free state.
	q.Add("poll", I{10})

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

	res, err = mc.G().API.Get(APIArg{
		Endpoint:       "merkle/path",
		SessionType:    APISessionTypeNONE,
		Args:           q,
		AppStatusCodes: []int{SCOk, SCNotFound, SCDeleted},
		NetContext:     ctx,
	})

	if err != nil {
		return nil, nil, nil, err
	}
	switch res.AppStatus.Code {
	case SCNotFound:
		err = NotFoundError{}
		return nil, nil, nil, err
	case SCDeleted:
		err = DeletedError{}
		return nil, nil, nil, err
	}

	if sigHints != nil {
		if err = sigHints.RefreshWith(ctx, res.Body.AtKey("sigs")); err != nil {
			return nil, nil, nil, err
		}
	}

	var ret *VerificationPath
	ret, err = mc.readPathFromAPIRes(ctx, res)
	if err != nil {
		return nil, nil, nil, err
	}
	ss, err = mc.readSkipSequenceFromAPIRes(ctx, res, ret.root, lastRoot)
	if err != nil {
		return nil, nil, nil, err
	}
	return ret, ss, res, err
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

func readRootFromAPIRes(g *GlobalContext, jw *jsonw.Wrapper) (*MerkleRoot, error) {
	ret, err := NewMerkleRootFromJSON(jw, g)
	if err != nil {
		return nil, err
	}
	ret.fetched = g.Clock().Now()
	return ret, nil
}

// readSkipSequenceFromAPIRes returns a SkipSequence. We construct the sequence by starting with the
// most recent merkle root, adding the "skip" pointers returned by the server, and finally bookending
// with the merkle root we last fetched from the DB. In verifySkipSequence, we walk over this Sequence
// to make sure that it obeys proper construction.
func (mc *MerkleClient) readSkipSequenceFromAPIRes(ctx context.Context, res *APIRes, thisRoot *MerkleRoot, lastRoot *MerkleRoot) (ret SkipSequence, err error) {
	defer mc.G().CTrace(ctx, "MerkleClient#readSkipSequenceFromAPIRes", func() error { return err })()
	if lastRoot == nil {
		mc.G().Log.CDebugf(ctx, "| lastRoot==nil")
		return nil, nil
	}
	if !thisRoot.HasSkips() {
		mc.G().Log.CDebugf(ctx, "| thisRoot has no skips")
		return nil, nil
	}
	skips := res.Body.AtKey("skips")

	if skips.IsNil() {
		mc.G().Log.CDebugf(ctx, "| skip list from API server is nil")
		return nil, nil
	}

	var v []string
	if err = skips.UnmarshalAgain(&v); err != nil {
		mc.G().Log.CDebugf(ctx, "| failed to unmarshal skip list as a list of strings")
		return nil, err
	}

	ret, err = readSkipSequenceFromStringList(v)
	if err != nil {
		return nil, err
	}

	// Create the skip sequence by bookending the list the server replies with
	// with: (1) the most recent root, sent back in this reply; and (2) our last
	// root, which we read out of cache (in memory or on disk)
	ret = append(SkipSequence{thisRoot.payload}, ret...)
	ret = append(ret, lastRoot.payload)

	return ret, nil
}

func (mc *MerkleClient) readPathFromAPIRes(ctx context.Context, res *APIRes) (ret *VerificationPath, err error) {
	defer mc.G().CTrace(ctx, "MerkleClient#readPathFromAPIRes", func() error { return err })()

	ret = &VerificationPath{
		Contextified: NewContextified(mc.G()),
	}

	ret.root, err = readRootFromAPIRes(mc.G(), res.Body.AtKey("root"))
	if err != nil {
		return nil, err
	}

	ret.uid, err = GetUID(res.Body.AtKey("uid"))
	if err != nil {
		return nil, err
	}

	// We don't trust this version, but it's useful to tell us if there
	// are new versions unsigned data, like basics, and maybe uploaded
	// keys
	ret.idVersion, err = res.Body.AtKey("id_version").GetInt64()
	if err != nil {
		return nil, err
	}

	ret.path, err = importPathFromJSON(res.Body.AtKey("path"))
	if err != nil {
		return nil, err
	}

	ret.uidPath, err = importPathFromJSON(res.Body.AtKey("uid_proof_path"))
	if err != nil {
		return nil, err
	}

	ret.username, err = res.Body.AtKey("username").GetString()
	if err != nil {
		return nil, err
	}
	ret.usernameCased, _ = res.Body.AtKey("username_cased").GetString()

	return ret, nil
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
func (mc *MerkleClient) storeRoot(ctx context.Context, root *MerkleRoot, storeFirstSkip bool) {
	err := root.Store(storeFirstSkip)
	if err != nil {
		mc.G().Log.Errorf("Cannot commit Merkle root to local DB: %s", err)
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

func (mc *MerkleClient) verifySkipSequence(ctx context.Context, ss SkipSequence, thisRoot *MerkleRoot, lastRoot *MerkleRoot) (err error) {
	defer mc.G().CTrace(ctx, "MerkleClient#verifySkipSequence", func() error { return err })()

	// In this case, the server did not return a skip sequence. It's OK if
	// the last known root is too old. It's not OK if the last known root is
	// from after the server starting providing skip pointers.
	if ss == nil {
		mc.G().Log.CDebugf(ctx, "| nil SkipSequence")
		fss := mc.FirstSeqnoWithSkips()
		if lastRoot == nil {
			mc.G().Log.CDebugf(ctx, "| lastRoot==nil, so OK")
			return nil
		}
		if fss == nil {
			mc.G().Log.CDebugf(ctx, "| no known root with skips, so OK")
			return nil
		}
		if *fss > *lastRoot.Seqno() {
			mc.G().Log.CDebugf(ctx, "| lastRoot (%d) is from before first known root with skips (%d), so OK", int(*lastRoot.Seqno()), int(*fss))
			return nil
		}
		if thisRoot != nil && *lastRoot.Seqno() == *thisRoot.Seqno() {
			mc.G().Log.CDebugf(ctx, "| thisRoot is the same as lastRoot (%d), so OK", int(*lastRoot.Seqno()))
			return nil
		}
		return MerkleClientError{fmt.Sprintf("Expected a skip sequence with last=%d", int(*lastRoot.Seqno())), merkleErrorNoSkipSequence}
	}
	if *thisRoot.Seqno() == *lastRoot.Seqno() {
		mc.G().Log.CDebugf(ctx, "| No change since last check (seqno %d)", *thisRoot.Seqno())
		return nil
	}
	return ss.verify(ctx, mc.G(), *thisRoot.Seqno(), *lastRoot.Seqno())
}

// verify verifies the raw "Skip Sequence" ss. ss contains a list of MerkleRootPayloads beginning
// with the most recently returned root, and ending with the last root that we fetched. So for instance,
// it might contain: [ 100, 84, 82, 81 ] in that case that we last fetched Seqno=81 and the server is
// currently at Seqno=100.
func (ss SkipSequence) verify(ctx context.Context, g *GlobalContext, thisRoot keybase1.Seqno, lastRoot keybase1.Seqno) (err error) {
	defer g.CTrace(ctx, "SkipSequence#verify", func() error { return err })()

	for index := 0; index < len(ss)-1; index++ {
		nextIndex := index + 1
		thisRoot, prevRoot := ss[index].seqno(), ss[nextIndex].seqno()
		g.Log.CDebugf(ctx, "| Checking skip %d->%d", thisRoot, prevRoot)

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
			g.Log.CDebugf(ctx, "| Failure in hashes: %s != %s", hash.String(), ss[nextIndex].shortHash().String())
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

func (mc *MerkleClient) verifyAndStoreRoot(ctx context.Context, root *MerkleRoot, seqnoWhenCalled *keybase1.Seqno) error {

	// First make sure it's not a rollback
	if seqnoWhenCalled != nil && *seqnoWhenCalled > *root.Seqno() {
		return fmt.Errorf("Server rolled back Merkle tree: %d > %d", *seqnoWhenCalled, root.Seqno())
	}

	mc.G().Log.CDebugf(ctx, "| Merkle root: got back %d, >= cached %v", int(*root.Seqno()), seqnoWhenCalled)

	mc.Lock()
	defer mc.Unlock()

	// Maybe we've already verified it before.
	verified, found := mc.verified[*root.Seqno()]
	if verified && found {
		mc.storeRoot(ctx, root, false)
		return nil
	}

	kid, sig, err := mc.findValidKIDAndSig(root)
	if err != nil {
		return err
	}
	mc.G().Log.CDebugf(ctx, "+ Merkle: using KID=%s for verifying server sig", kid)

	key, err := mc.keyring.Load(kid)
	if err != nil {
		return err
	}

	mc.G().Log.CDebugf(ctx, "- Merkle: server sig verified")

	if key == nil {
		return MerkleClientError{"no known verifying key", merkleErrorNoKnownKey}
	}

	// Actually run the PGP verification over the signature
	_, err = key.VerifyString(mc.G().Log, sig, []byte(root.payload.packed))
	if err != nil {
		return err
	}

	mc.verified[*root.Seqno()] = true

	newFirstSkip := false
	if mc.firstSkip == nil && root.HasSkips() && mc.G().Env.GetRunMode() != ProductionRunMode {
		mc.firstSkip = root
		newFirstSkip = true
	}

	mc.storeRoot(ctx, root, newFirstSkip)

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

	return &user, nil
}

func parseMerkleUserLeaf(ctx context.Context, jw *jsonw.Wrapper, g *GlobalContext) (user *MerkleUserLeaf, err error) {
	g.Log.CDebugf(ctx, "+ ParsingMerkleUserLeaf")

	if jw == nil {
		g.Log.CDebugf(ctx, "| empty leaf found; user wasn't in tree")
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

	g.Log.CDebugf(ctx, "- ParsingMerkleUserLeaf -> %v", ErrToOk(err))
	return
}

func (vp *VerificationPath) verifyUsername(ctx context.Context) (username string, err error) {
	if CheckUIDAgainstUsername(vp.uid, vp.username) == nil {
		vp.G().Log.CDebugf(ctx, "| Username %s mapped to %s via direct hash", vp.username, vp.uid)
		username = vp.username
		return
	}

	vp.G().Log.CDebugf(ctx, "| Failed to map Username %s -> UID %s via direct hash", vp.username, vp.uid)

	if vp.usernameCased != vp.username && strings.ToLower(vp.usernameCased) == vp.username {
		vp.G().Log.CDebugf(ctx, "| Checking cased username difference: %s v %s", vp.username, vp.usernameCased)
		if CheckUIDAgainstCasedUsername(vp.uid, vp.usernameCased) == nil {
			vp.G().Log.CDebugf(ctx, "| Username %s mapped to %s via direct hash (w/ username casing)", vp.usernameCased, vp.uid)
			username = vp.username
			return
		}
	}

	hsh := sha256.Sum256([]byte(strings.ToLower(vp.username)))
	hshS := hex.EncodeToString(hsh[:])
	var leaf *jsonw.Wrapper

	if vp.root.LegacyUIDRootHash() == nil {
		err = MerkleClientError{"no legacy UID root hash found in root", merkleErrorNoLegacyUIDRoot}
		return
	}

	if leaf, err = vp.uidPath.VerifyPath(vp.root.LegacyUIDRootHash(), hshS); err != nil {
		return
	}

	var uid2 keybase1.UID
	if uid2, err = GetUID(leaf); err != nil {
		return
	}
	if vp.uid.NotEqual(uid2) {
		err = UIDMismatchError{fmt.Sprintf("UID %s != %s via merkle tree", uid2, vp.uid)}
		return
	}

	vp.G().Log.CDebugf(ctx, "| Username %s mapped to %s via Merkle lookup", vp.username, vp.uid)
	username = vp.username

	return
}

func (vp *VerificationPath) verifyUser(ctx context.Context) (user *MerkleUserLeaf, err error) {
	curr := vp.root.RootHash()

	var leaf *jsonw.Wrapper
	leaf, err = vp.path.VerifyPath(curr, vp.uid.String())

	if leaf != nil && err == nil {
		if leaf, err = leaf.ToArray(); err != nil {
			msg := fmt.Sprintf("Didn't find a leaf for user in tree: %s", err)
			err = MerkleNotFoundError{vp.uid.String(), msg}
		}
	}

	if err == nil {
		// noop
	} else if _, ok := err.(MerkleNotFoundError); ok {
		vp.G().Log.CDebugf(ctx, fmt.Sprintf("In checking Merkle tree: %s", err))
	} else {
		return
	}

	user, err = parseMerkleUserLeaf(ctx, leaf, vp.G())
	if user != nil {
		user.uid = vp.uid
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
				err = MerkleNotFoundError{uidS, err.Error()}
				break
			}
			juser = nil
		} else {
			juser = jw.AtKey("tab").AtKey(uidS)
		}
	}

	if err == nil && juser == nil {
		err = MerkleNotFoundError{uidS, "tree path didn't end in a leaf"}
	}
	return
}

func (mc *MerkleClient) verifySkipSequenceAndRootThenStore(ctx context.Context, ss SkipSequence, curr *MerkleRoot, prev *MerkleRoot, apiRes *APIRes) (err error) {

	defer func() {
		if err != nil {
			mc.G().Log.CDebugf(ctx, "| Full APIRes was: %s", apiRes.Body.MarshalToDebug())
		}
	}()

	// It's important to check the merkle skip sequence before verifying the root.
	if err = mc.verifySkipSequence(ctx, ss, curr, prev); err != nil {
		return err
	}
	if err = mc.verifyAndStoreRoot(ctx, curr, prev.Seqno()); err != nil {
		return err
	}
	return nil
}

func (mc *MerkleClient) LookupUser(ctx context.Context, q HTTPArgs, sigHints *SigHints) (u *MerkleUserLeaf, err error) {

	mc.G().Log.CDebugf(ctx, "+ MerkleClient.LookupUser(%v)", q)

	var path *VerificationPath
	var ss SkipSequence
	var apiRes *APIRes

	if err = mc.init(ctx); err != nil {
		return nil, err
	}

	// Grab the cached seqno before the call to get the next one is made.
	// Note, we can have multiple concurrenct calls to LookupUser that can return in any order.
	// Checking against the cache after the call completes can cause false-positive rollback
	// warnings if the first call is super slow, and the second call is super fast, and there
	// was a change on the server side. See CORE-4064.
	rootBeforeCall := mc.LastRoot()

	if path, ss, apiRes, err = mc.lookupPathAndSkipSequence(ctx, q, sigHints, rootBeforeCall); err != nil {
		return nil, err
	}

	if err = mc.verifySkipSequenceAndRootThenStore(ctx, ss, path.root, rootBeforeCall, apiRes); err != nil {
		return nil, err
	}

	if u, err = path.verifyUser(ctx); err != nil {
		return nil, err
	}

	if u.username, err = path.verifyUsername(ctx); err != nil {
		return nil, err
	}

	u.idVersion = path.idVersion

	mc.G().Log.CDebugf(ctx, "- MerkleClient.LookupUser(%v) -> OK", q)
	return u, nil
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

func (mc *MerkleClient) LastRootToSigJSON() (ret *jsonw.Wrapper, err error) {
	// Lazy-init, only when needed.
	if err = mc.init(context.TODO()); err == nil {
		mc.RLock()
		if mc.lastRoot != nil {
			ret = mc.lastRoot.ToSigJSON()
		}
		mc.RUnlock()
	}
	return
}

// Can return (nil, nil) if no root is known.
func (mc *MerkleClient) LastRootInfo() (*chat1.MerkleRoot, error) {
	// Lazy-init, only when needed.
	err := mc.init(context.TODO())
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

func (mt1 MerkleTriple) Less(mt2 MerkleTriple) bool {
	return mt1.Seqno < mt2.Seqno
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
