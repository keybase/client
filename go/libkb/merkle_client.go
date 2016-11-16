// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type Seqno int64

const (
	NodeHashLenLong  = sha512.Size // = 64
	NodeHashLenShort = sha256.Size // = 32
)

type NodeHash interface {
	Check(s string) bool // Check if the node hashes to this string
	String() string
}

type NodeHashShort [NodeHashLenShort]byte
type NodeHashLong [NodeHashLenLong]byte

func (h1 NodeHashShort) Check(s string) bool {
	h2 := sha256.Sum256([]byte(s))
	return FastByteArrayEq(h1[:], h2[:])
}

func (h1 NodeHashShort) String() string {
	return hex.EncodeToString(h1[:])
}

func (h1 NodeHashLong) String() string {
	return hex.EncodeToString(h1[:])
}

func (h1 NodeHashLong) Check(s string) bool {
	h2 := sha512.Sum512([]byte(s))
	return FastByteArrayEq(h1[:], h2[:])
}

type MerkleClient struct {
	Contextified

	keyring *SpecialKeyRing

	// Blocks that have been verified
	verified map[Seqno]bool

	// The most recently-available root
	lastRoot *MerkleRoot

	// protects whole object
	sync.RWMutex
}

type MerkleRoot struct {
	Contextified
	seqno             Seqno
	pgpFingerprint    PGPFingerprint
	sigs              *jsonw.Wrapper
	payloadJSONString string
	payloadJSON       *jsonw.Wrapper
	rootHash          NodeHash
	legacyUIDRootHash NodeHash
	ctime             int64
}

type MerkleTriple struct {
	Seqno  Seqno          `json:"seqno"`
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
		verified:     make(map[Seqno]bool),
		lastRoot:     nil,
		Contextified: NewContextified(g),
	}
}

func (mc *MerkleClient) Init() error {
	return mc.LoadRoot()
}

func merkleHeadKey() DbKey {
	return DbKey{
		Typ: DBLookupMerkleRoot,
		Key: "HEAD",
	}
}

func (mc *MerkleClient) LoadRoot() error {
	mc.G().Log.Debug("+ MerkleClient.LoadRoot()")
	curr, err := mc.G().LocalDb.Lookup(merkleHeadKey())
	if err != nil {
		return err
	}
	if curr == nil {
		mc.G().Log.Debug("- MerkleClient.LoadRoot() -> nil")
		return nil
	}
	mr, err := NewMerkleRootFromJSON(curr, mc.G())
	if err != nil {
		return err
	}
	mc.Lock()
	mc.lastRoot = mr
	mc.G().Log.Debug("- MerkleClient.LoadRoot() -> %v", mc.lastRoot)
	mc.Unlock()
	return nil
}

func (mr *MerkleRoot) Store() error {
	err := mr.G().LocalDb.Put(DbKey{
		Typ: DBMerkleRoot,
		Key: fmt.Sprintf("%d", mr.seqno),
	},
		[]DbKey{merkleHeadKey()},
		mr.ToJSON(),
	)
	return err
}

func (mr *MerkleRoot) ToJSON() (jw *jsonw.Wrapper) {
	ret := jsonw.NewDictionary()
	ret.SetKey("sigs", mr.sigs)
	ret.SetKey("payload_json", jsonw.NewString(mr.payloadJSONString))
	return ret
}

func NewMerkleRootFromJSON(jw *jsonw.Wrapper, g *GlobalContext) (ret *MerkleRoot, err error) {
	var seqno int64
	var sigs *jsonw.Wrapper
	var payloadJSONString string
	var pj *jsonw.Wrapper
	var fp PGPFingerprint
	var rh, lurh NodeHash
	var ctime int64

	if sigs, err = jw.AtKey("sigs").ToDictionary(); err != nil {
		return
	}

	if payloadJSONString, err = jw.AtKey("payload_json").GetString(); err != nil {
		return
	}

	if pj, err = jsonw.Unmarshal([]byte(payloadJSONString)); err != nil {
		return
	}

	GetPGPFingerprintVoid(pj.AtPath("body.key.fingerprint"), &fp, &err)
	pj.AtPath("body.seqno").GetInt64Void(&seqno, &err)
	GetNodeHashVoid(pj.AtPath("body.root"), &rh, &err)
	lurh, _ = GetNodeHash(pj.AtPath("body.legacy_uid_root"))
	pj.AtKey("ctime").GetInt64Void(&ctime, &err)

	if err != nil {
		return
	}

	ret = &MerkleRoot{
		seqno:             Seqno(seqno),
		pgpFingerprint:    fp,
		sigs:              sigs,
		payloadJSONString: payloadJSONString,
		payloadJSON:       pj,
		rootHash:          rh,
		legacyUIDRootHash: lurh,
		ctime:             ctime,
		Contextified:      NewContextified(g),
	}
	return
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

func (mc *MerkleClient) LookupPath(q HTTPArgs, sigHints *SigHints) (vp *VerificationPath, err error) {

	// Poll for 10s and ask for a race-free state.
	q.Add("poll", I{10})

	// Add the local db sigHints version
	if sigHints != nil {
		q.Add("sig_hints_low", I{sigHints.version})
	}

	res, err := mc.G().API.Get(APIArg{
		Endpoint:       "merkle/path",
		NeedSession:    false,
		Args:           q,
		AppStatusCodes: []int{SCOk, SCNotFound, SCDeleted},
	})

	if err != nil {
		return
	}
	switch res.AppStatus.Code {
	case SCNotFound:
		err = NotFoundError{}
		return
	case SCDeleted:
		err = DeletedError{}
		return
	}

	if sigHints != nil {
		if err = sigHints.RefreshWith(res.Body.AtKey("sigs")); err != nil {
			return
		}
	}

	root, err := NewMerkleRootFromJSON(res.Body.AtKey("root"), mc.G())
	if err != nil {
		return
	}

	uid, err := GetUID(res.Body.AtKey("uid"))
	if err != nil {
		return
	}

	// We don't trust this version, but it's useful to tell us if there
	// are new versions unsigned data, like basics, and maybe uploaded
	// keys
	idv, err := res.Body.AtKey("id_version").GetInt64()
	if err != nil {
		return
	}

	pathOut, err := importPathFromJSON(res.Body.AtKey("path"))
	if err != nil {
		return
	}

	uidPathOut, err := importPathFromJSON(res.Body.AtKey("uid_proof_path"))
	if err != nil {
		return
	}

	username, err := res.Body.AtKey("username").GetString()
	if err != nil {
		return
	}
	usernameCased, _ := res.Body.AtKey("username_cased").GetString()

	vp = &VerificationPath{
		uid:           uid,
		root:          root,
		path:          pathOut,
		uidPath:       uidPathOut,
		idVersion:     idv,
		username:      username,
		usernameCased: usernameCased,
		Contextified:  NewContextified(mc.G()),
	}
	return
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

func (mc *MerkleClient) LastSeqno() Seqno {
	mc.RLock()
	defer mc.RUnlock()
	if mc.lastRoot != nil {
		return mc.lastRoot.seqno
	}
	return -1
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
	return nilKID, "", MerkleClientError{"no known verifying key"}
}

func (mc *MerkleClient) VerifyRoot(root *MerkleRoot, seqnoWhenCalled Seqno) error {

	// First make sure it's not a rollback
	if seqnoWhenCalled >= 0 && seqnoWhenCalled > root.seqno {
		return fmt.Errorf("Server rolled back Merkle tree: %d > %d",
			seqnoWhenCalled, root.seqno)
	}

	mc.G().Log.Debug("| Merkle root: got back %d, >= cached %d", int(root.seqno), int(seqnoWhenCalled))

	mc.Lock()
	defer mc.Unlock()

	// Maybe we've already verified it before.
	verified, found := mc.verified[root.seqno]
	if verified && found {
		return nil
	}

	kid, sig, err := mc.findValidKIDAndSig(root)
	if err != nil {
		return err
	}
	mc.G().Log.Debug("+ Merkle: using KID=%s for verifying server sig", kid)

	key, err := mc.keyring.Load(kid)
	if err != nil {
		return err
	}

	mc.G().Log.Debug("- Merkle: server sig verified")

	if key == nil {
		return MerkleClientError{"no known verifying key"}
	}

	// Actually run the PGP verification over the signature
	_, err = key.VerifyString(mc.G().Log, sig, []byte(root.payloadJSONString))
	if err != nil {
		return err
	}

	if e2 := root.Store(); e2 != nil {
		mc.G().Log.Errorf("Cannot commit Merkle root to local DB: %s", e2)
	}

	mc.verified[root.seqno] = true

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
	seqno, err := jw.AtIndex(0).GetInt()
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

	return &MerkleTriple{Seqno(seqno), li, si}, nil

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

func parseMerkleUserLeaf(jw *jsonw.Wrapper, g *GlobalContext) (user *MerkleUserLeaf, err error) {
	g.Log.Debug("+ ParsingMerkleUserLeaf")

	if jw == nil {
		g.Log.Debug("| empty leaf found; user wasn't in tree")
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

	g.Log.Debug("- ParsingMerkleUserLeaf -> %v", ErrToOk(err))
	return
}

func (vp *VerificationPath) VerifyUsername() (username string, err error) {
	if CheckUIDAgainstUsername(vp.uid, vp.username) == nil {
		vp.G().Log.Debug("| Username %s mapped to %s via direct hash", vp.username, vp.uid)
		username = vp.username
		return
	}

	vp.G().Log.Debug("| Failed to map Username %s -> UID %s via direct hash", vp.username, vp.uid)

	if vp.usernameCased != vp.username && strings.ToLower(vp.usernameCased) == vp.username {
		vp.G().Log.Debug("| Checking cased username difference: %s v %s", vp.username, vp.usernameCased)
		if CheckUIDAgainstCasedUsername(vp.uid, vp.usernameCased) == nil {
			vp.G().Log.Debug("| Username %s mapped to %s via direct hash (w/ username casing)", vp.usernameCased, vp.uid)
			username = vp.username
			return
		}
	}

	hsh := sha256.Sum256([]byte(strings.ToLower(vp.username)))
	hshS := hex.EncodeToString(hsh[:])
	var leaf *jsonw.Wrapper

	if vp.root.legacyUIDRootHash == nil {
		err = MerkleClientError{"no legacy UID root hash found in root"}
		return
	}

	if leaf, err = vp.uidPath.VerifyPath(vp.root.legacyUIDRootHash, hshS); err != nil {
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

	vp.G().Log.Debug("| Username %s mapped to %s via Merkle lookup", vp.username, vp.uid)
	username = vp.username

	return
}

func (vp *VerificationPath) VerifyUser() (user *MerkleUserLeaf, err error) {
	curr := vp.root.rootHash

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
		vp.G().Log.Debug(fmt.Sprintf("In checking Merkle tree: %s", err))
	} else {
		return
	}

	user, err = parseMerkleUserLeaf(leaf, vp.G())
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

func (mc *MerkleClient) LookupUser(q HTTPArgs, sigHints *SigHints) (u *MerkleUserLeaf, err error) {

	mc.G().Log.Debug("+ MerkleClient.LookupUser(%v)", q)

	var path *VerificationPath

	if err = mc.Init(); err != nil {
		return
	}

	// Grab the cached seqno before the call to get the next one is made.
	// Note, we can have multiple concurrenct calls to LookupUser that can return in any order.
	// Checking against the cache after the call completes can cause false-positive rollback
	// warnings if the first call is super slow, and the second call is super fast, and there
	// was a change on the server side. See CORE-4064.
	seqnoBeforeCall := mc.LastSeqno()

	mc.G().Log.Debug("| LookupPath")
	if path, err = mc.LookupPath(q, sigHints); err != nil {
		return
	}

	mc.G().Log.Debug("| VerifyRoot")
	if err = mc.VerifyRoot(path.root, seqnoBeforeCall); err != nil {
		return
	}

	mc.G().Log.Debug("| VerifyUser")
	if u, err = path.VerifyUser(); err != nil {
		return
	}

	mc.G().Log.Debug("| VerifyUsername")
	if u.username, err = path.VerifyUsername(); err != nil {
		return
	}

	u.idVersion = path.idVersion

	mc.G().Log.Debug("- MerkleClient.LookupUser(%v) -> OK", q)
	return
}

func (mr *MerkleRoot) ToSigJSON() (ret *jsonw.Wrapper) {

	ret = jsonw.NewDictionary()
	ret.SetKey("seqno", jsonw.NewInt(int(mr.seqno)))
	ret.SetKey("ctime", jsonw.NewInt64(mr.ctime))
	ret.SetKey("hash", jsonw.NewString(mr.rootHash.String()))

	return
}

func (mc *MerkleClient) LastRootToSigJSON() (ret *jsonw.Wrapper, err error) {
	// Lazy-init, only when needed.
	if err = mc.Init(); err == nil {
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
		err = MerkleClientError{fmt.Sprintf("vs loaded object: UID %s != %s", mul.uid, u.GetUID())}
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
