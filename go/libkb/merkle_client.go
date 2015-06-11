package libkb

import (
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

type Seqno int64

const (
	NODE_HASH_LEN_LONG  = sha512.Size // = 64
	NODE_HASH_LEN_SHORT = sha256.Size // = 32
)

type NodeHash interface {
	Check(s string) bool // Check if the node hashes to this string
	String() string
}

type NodeHashShort [NODE_HASH_LEN_SHORT]byte
type NodeHashLong [NODE_HASH_LEN_LONG]byte

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
	keyring *SpecialKeyRing

	// Blocks that have been verified
	verified map[Seqno]bool

	// The most recently-available root
	lastRoot *MerkleRoot

	// protects whole object
	sync.RWMutex
}

type MerkleRoot struct {
	seqno             Seqno
	pgpFingerprint    PgpFingerprint
	sigs              *jsonw.Wrapper
	payloadJsonString string
	payloadJson       *jsonw.Wrapper
	rootHash          NodeHash
	legacyUidRootHash NodeHash
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
	eldest    *KID
}

type PathSteps []*PathStep

type VerificationPath struct {
	uid       keybase1.UID
	root      *MerkleRoot
	path      PathSteps
	uidPath   PathSteps
	idVersion int64
	username  string
}

type PathStep struct {
	prefix string
	node   string // The JSON-stringified version of the node (to be unpacked lazily)
}

func NodeHashFromHex(s string) (NodeHash, error) {
	buf := make([]byte, NODE_HASH_LEN_LONG)
	n, err := hex.Decode(buf, []byte(s))
	var ret NodeHash
	if err != nil {
		// Noop
	} else if n == NODE_HASH_LEN_LONG {
		var tmp NodeHashLong
		copy([]byte(tmp[:]), buf)
		ret = tmp
	} else if n == NODE_HASH_LEN_SHORT {
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
		keyring:  NewSpecialKeyRing(g.Env.GetMerkleKIDs()),
		verified: make(map[Seqno]bool),
		lastRoot: nil,
	}
}

func (mc *MerkleClient) Init() error {
	return mc.LoadRoot()
}

func merkleHeadKey() DbKey {
	return DbKey{
		Typ: DB_LOOKUP_MERKLE_ROOT,
		Key: "HEAD",
	}
}

func (mc *MerkleClient) LoadRoot() error {
	G.Log.Debug("+ MerkleClient.LoadRoot()")
	curr, err := G.LocalDb.Lookup(merkleHeadKey())
	if err != nil {
		return err
	}
	if curr == nil {
		G.Log.Debug("- MerkleClient.LoadRoot() -> nil")
		return nil
	}
	mr, err := NewMerkleRootFromJson(curr)
	if err != nil {
		return err
	}
	mc.Lock()
	mc.lastRoot = mr
	G.Log.Debug("- MerkleClient.LoadRoot() -> %d", mc.lastRoot.seqno)
	mc.Unlock()
	return nil
}

func (mr *MerkleRoot) Store() error {
	err := G.LocalDb.Put(DbKey{
		Typ: DB_MERKLE_ROOT,
		Key: fmt.Sprintf("%d", mr.seqno),
	},
		[]DbKey{merkleHeadKey()},
		mr.ToJson(),
	)
	return err
}

func (mr *MerkleRoot) ToJson() (jw *jsonw.Wrapper) {
	ret := jsonw.NewDictionary()
	ret.SetKey("sigs", mr.sigs)
	ret.SetKey("payload_json", jsonw.NewString(mr.payloadJsonString))
	return ret
}

func NewMerkleRootFromJson(jw *jsonw.Wrapper) (ret *MerkleRoot, err error) {
	var seqno int64
	var sigs *jsonw.Wrapper
	var payloadJsonString string
	var pj *jsonw.Wrapper
	var fp PgpFingerprint
	var rh, lurh NodeHash
	var ctime int64

	if sigs, err = jw.AtKey("sigs").ToDictionary(); err != nil {
		return
	}

	if payloadJsonString, err = jw.AtKey("payload_json").GetString(); err != nil {
		return
	}

	if pj, err = jsonw.Unmarshal([]byte(payloadJsonString)); err != nil {
		return
	}

	GetPgpFingerprintVoid(pj.AtPath("body.key.fingerprint"), &fp, &err)
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
		payloadJsonString: payloadJsonString,
		payloadJson:       pj,
		rootHash:          rh,
		legacyUidRootHash: lurh,
		ctime:             ctime,
	}
	return
}

func importPathFromJson(jw *jsonw.Wrapper) (out []*PathStep, err error) {
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
		if step, err = pathStepFromJson(path.AtIndex(i)); err != nil {
			return
		}
		out = append(out, step)
	}
	return
}

func (mc *MerkleClient) LookupPath(q HttpArgs) (vp *VerificationPath, err error) {

	// Poll for 10s and ask for a race-free state.
	q.Add("poll", I{10})

	res, err := G.API.Get(ApiArg{
		Endpoint:    "merkle/path",
		NeedSession: false,
		Args:        q,
	})

	if err != nil {
		return
	}

	root, err := NewMerkleRootFromJson(res.Body.AtKey("root"))
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

	pathOut, err := importPathFromJson(res.Body.AtKey("path"))
	if err != nil {
		return
	}

	uidPathOut, err := importPathFromJson(res.Body.AtKey("uid_proof_path"))
	if err != nil {
		return
	}

	username, err := res.Body.AtKey("username").GetString()
	if err != nil {
		return
	}

	vp = &VerificationPath{uid, root, pathOut, uidPathOut, idv, username}
	return
}

func pathStepFromJson(jw *jsonw.Wrapper) (ps *PathStep, err error) {

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

func (mc *MerkleClient) findValidKIDAndSig(root *MerkleRoot) (KID, string, error) {
	if v, err := root.sigs.Keys(); err == nil {
		for _, s := range v {
			if kid, err := ImportKID(s); err != nil {
				continue
			} else if !mc.keyring.IsValidKID(kid) {
				continue
			} else if sig, err := root.sigs.AtKey(s).AtKey("sig").GetString(); err == nil {
				return kid, sig, nil
			}
		}
	}
	return nil, "", MerkleClientError{"no known verifying key"}
}

func (mc *MerkleClient) VerifyRoot(root *MerkleRoot) error {

	// First make sure it's not a rollback
	q := mc.LastSeqno()
	if q >= 0 && q > root.seqno {
		return fmt.Errorf("Server rolled back Merkle tree: %d > %d",
			q, root.seqno)
	}

	G.Log.Debug("| Merkle root: got back %d, >= cached %d", int(root.seqno), int(q))

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
	G.Log.Debug("+ Merkle: using KID=%s for verifying server sig", kid)

	key, err := mc.keyring.Load(kid)
	if err != nil {
		return err
	}

	G.Log.Debug("- Merkle: server sig verified")

	if key == nil {
		return MerkleClientError{"no known verifying key"}
	}

	// Actually run the PGP verification over the signature
	_, err = key.VerifyString(sig, []byte(root.payloadJsonString))
	if err != nil {
		return err
	}

	if e2 := root.Store(); e2 != nil {
		G.Log.Errorf("Cannot commit Merkle root to local DB: %s", e2.Error())
	}

	mc.verified[root.seqno] = true

	return nil
}

func parseTriple(jw *jsonw.Wrapper) (t *MerkleTriple, err error) {
	var seqno, l int
	var li LinkID
	var si keybase1.SigID

	if jw.IsNil() {
		return nil, nil
	}

	if l, err = jw.Len(); err != nil {
		return
	}
	if l == 0 {
		return nil, nil
	} else if l == 1 {
		err = fmt.Errorf("Bad merkle 'triple', with < 2 values")
	} else if l > 3 {
		err = fmt.Errorf("Bad merkle triple, with > 3 values")
	} else if seqno, err = jw.AtIndex(0).GetInt(); err != nil {
		// noop
	} else if li, err = GetLinkID(jw.AtIndex(1)); err != nil {
		// noop
	} else if l == 2 {
		// noop
	} else {
		si, err = GetSigID(jw.AtIndex(2), false)
	}
	if err == nil {
		t = &MerkleTriple{Seqno(seqno), li, si}
	}
	return

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
		user.eldest = &eldest
	}

	return &user, nil
}

func ParseMerkleUserLeaf(jw *jsonw.Wrapper) (user *MerkleUserLeaf, err error) {
	G.Log.Debug("+ ParsingMerkleUserLeaf")

	if jw == nil {
		G.Log.Debug("| empty leaf found; user wasn't in tree")
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

	G.Log.Debug("- ParsingMerkleUserLeaf -> %v", err)
	return
}

func (vp *VerificationPath) VerifyUsername() (username string, err error) {
	if CheckUIDAgainstUsername(vp.uid, vp.username) == nil {
		G.Log.Debug("| Username %s mapped to %s via direct hash", vp.username, vp.uid)
		username = vp.username
		return
	}
	hsh := sha256.Sum256([]byte(strings.ToLower(vp.username)))
	hshS := hex.EncodeToString(hsh[:])
	var leaf *jsonw.Wrapper

	if vp.root.legacyUidRootHash == nil {
		err = MerkleClientError{"no legacy UID root hash found in root"}
		return
	}

	if leaf, err = vp.uidPath.VerifyPath(vp.root.legacyUidRootHash, hshS); err != nil {
		return
	}

	var uid2 keybase1.UID
	if uid2, err = GetUID(leaf); err != nil {
		return
	}
	if vp.uid.NotEqual(uid2) {
		err = UidMismatchError{fmt.Sprintf("UID %s != %s via merkle tree", uid2, vp.uid)}
		return
	}

	G.Log.Debug("| Username %s mapped to %s via Merkle lookup", vp.username, vp.uid)
	username = vp.username

	return
}

func (vp *VerificationPath) VerifyUser() (user *MerkleUserLeaf, err error) {
	curr := vp.root.rootHash

	var leaf *jsonw.Wrapper
	leaf, err = vp.path.VerifyPath(curr, vp.uid.String())

	if leaf != nil && err == nil {
		if leaf, err = leaf.ToArray(); err != nil {
			msg := fmt.Sprintf("Didn't find a leaf for user in tree: %s", err.Error())
			err = MerkleNotFoundError{vp.uid.String(), msg}
		}
	}

	if err == nil {
		// noop
	} else if _, ok := err.(MerkleNotFoundError); ok {
		G.Log.Debug(fmt.Sprintf("In checking Merkle tree: %s", err.Error()))
	} else {
		return
	}

	user, err = ParseMerkleUserLeaf(leaf)
	if user != nil {
		user.uid = vp.uid
	}
	return
}

func (path PathSteps) VerifyPath(curr NodeHash, uidS string) (juser *jsonw.Wrapper, err error) {

	bpath := uidS
	pos := 0
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
			err = fmt.Errorf("Can't parse JSON at level=%d: %s", i, err.Error())
			break
		}

		plen := len(step.prefix)

		epos := pos + plen
		if bpath[pos:epos] != step.prefix {
			err = fmt.Errorf("Path mismatch at level %d: %s != %s",
				i, bpath[pos:epos], step.prefix)
			break
		}
		pos = epos

		lastTyp, err = jw.AtKey("type").GetInt()
		if err != nil {
			err = fmt.Errorf("At level %d, failed to get a valid 'type'", i)
			break
		}

		if lastTyp == MERKLE_TREE_NODE {
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

func (mc *MerkleClient) LookupUser(q HttpArgs) (u *MerkleUserLeaf, err error) {

	G.Log.Debug("+ MerkleClient.LookupUser(%v)", q)

	var path *VerificationPath

	if err = mc.Init(); err != nil {
		return
	}

	G.Log.Debug("| LookupPath")
	if path, err = mc.LookupPath(q); err != nil {
		return
	}

	G.Log.Debug("| VerifyRoot")
	if err = mc.VerifyRoot(path.root); err != nil {
		return
	}

	G.Log.Debug("| VerifyUser")
	if u, err = path.VerifyUser(); err != nil {
		return
	}

	G.Log.Debug("| VerifyUsername")
	if u.username, err = path.VerifyUsername(); err != nil {
		return
	}

	u.idVersion = path.idVersion

	G.Log.Debug("- MerkleClient.LookupUser(%v) -> OK", q)
	return
}

func (mr *MerkleRoot) ToSigJson() (ret *jsonw.Wrapper) {

	ret = jsonw.NewDictionary()
	ret.SetKey("seqno", jsonw.NewInt(int(mr.seqno)))
	ret.SetKey("ctime", jsonw.NewInt64(mr.ctime))
	ret.SetKey("hash", jsonw.NewString(mr.rootHash.String()))

	return
}

func (mc *MerkleClient) LastRootToSigJson() (ret *jsonw.Wrapper, err error) {
	// Lazy-init, only when needed.
	if err = mc.Init(); err == nil {
		mc.RLock()
		ret = mc.lastRoot.ToSigJson()
		mc.RUnlock()
	}
	return
}

func (mul *MerkleUserLeaf) MatchUser(u *User, uid keybase1.UID, un string) (err error) {
	if mul.username != u.GetName() {
		err = MerkleClashError{fmt.Sprintf("vs loaded object: username %s != %s", mul.username, u.GetName())}
	} else if mul.uid.NotEqual(u.GetUID()) {
		err = MerkleClientError{fmt.Sprintf("vs loaded object: UID %s != %s", mul.uid, u.GetUID())}
	} else if len(un) > 0 && mul.username != un {
		err = MerkleClashError{fmt.Sprintf("vs given arg: username %s != %s", mul.username, un)}
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
