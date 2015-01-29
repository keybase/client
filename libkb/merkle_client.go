package libkb

import (
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"github.com/keybase/go-jsonw"
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
}

type MerkleRoot struct {
	seqno             Seqno
	pgpFingerprint    PgpFingerprint
	sig               string
	payloadJsonString string
	payloadJson       *jsonw.Wrapper
	rootHash          NodeHash
	ctime             int64
}

type MerkleTriple struct {
	seqno  Seqno
	linkId LinkId
	sigId  *SigId
}

type MerkleUserLeaf struct {
	public    *MerkleTriple
	private   *MerkleTriple
	idVersion int64
}

type VerificationPath struct {
	uid       UID
	root      *MerkleRoot
	path      [](*PathStep)
	idVersion int64
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

func NewMerkleClient(g *Global) *MerkleClient {
	return &MerkleClient{
		keyring:  NewSpecialKeyRing(g.Env.GetMerkleKeyFingerprints()),
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
	mc.lastRoot = mr
	G.Log.Debug("- MerkleClient.LoadRoot() -> %d", mc.lastRoot.seqno)
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
	ret.SetKey("sig", jsonw.NewString(mr.sig))
	ret.SetKey("payload_json", jsonw.NewString(mr.payloadJsonString))
	return ret
}

func NewMerkleRootFromJson(jw *jsonw.Wrapper) (ret *MerkleRoot, err error) {
	var seqno int64
	var sig string
	var payload_json_str string
	var pj *jsonw.Wrapper
	var fp PgpFingerprint
	var rh NodeHash
	var ctime int64

	jw.AtKey("sig").GetStringVoid(&sig, &err)
	jw.AtKey("payload_json").GetStringVoid(&payload_json_str, &err)

	if err != nil {
		return
	}

	pj, err = jsonw.Unmarshal([]byte(payload_json_str))
	if err != nil {
		return
	}

	GetPgpFingerprintVoid(pj.AtKey("body").AtKey("key").AtKey("fingerprint"), &fp, &err)
	pj.AtKey("body").AtKey("seqno").GetInt64Void(&seqno, &err)
	GetNodeHashVoid(pj.AtKey("body").AtKey("root"), &rh, &err)
	pj.AtKey("ctime").GetInt64Void(&ctime, &err)

	if err != nil {
		return
	}

	ret = &MerkleRoot{
		seqno:             Seqno(seqno),
		pgpFingerprint:    fp,
		sig:               sig,
		payloadJsonString: payload_json_str,
		payloadJson:       pj,
		rootHash:          rh,
		ctime:             ctime,
	}
	return
}

func (mc *MerkleClient) LookupPath(q HttpArgs) (vp *VerificationPath, err error) {

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

	path, err := res.Body.AtKey("path").ToArray()
	if err != nil {
		return
	}

	uid, err := GetUid(res.Body.AtKey("uid"))
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

	l, err := path.Len()
	if err != nil {
		return
	}

	path_out := make([](*PathStep), 0, l)
	for i := 0; i < l; i++ {
		var step *PathStep
		if step, err = pathStepFromJson(path.AtIndex(i)); err != nil {
			return
		} else {
			path_out = append(path_out, step)
		}
	}

	vp = &VerificationPath{*uid, root, path_out, idv}
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
	if mc.lastRoot != nil {
		return mc.lastRoot.seqno
	} else {
		return -1
	}
}

func (mc *MerkleClient) VerifyRoot(root *MerkleRoot) error {

	// First make sure it's not a rollback
	q := mc.LastSeqno()
	if q >= 0 && q > root.seqno {
		return fmt.Errorf("Server rolled back Merkle tree: %d > %d",
			q, root.seqno)
	}

	G.Log.Debug("| Merkle root: got back %d, >= cached %d", int(root.seqno), int(q))

	// Maybe we've already verified it before.
	verified, found := mc.verified[root.seqno]
	if verified && found {
		return nil
	}

	key, err := mc.keyring.Load(root.pgpFingerprint)
	if err != nil {
		return err
	}

	if key == nil {
		return fmt.Errorf("Failed to find a Merkle signing key for %s",
			root.pgpFingerprint.String())
	}

	// Actually run the PGP verification over the signature
	_, err = key.Verify(root.sig, []byte(root.payloadJsonString))
	if err != nil {
		return err
	}

	if e2 := root.Store(); e2 != nil {
		G.Log.Error("Cannot commit Merkle root to local DB: %s",
			e2.Error())
	}

	mc.verified[root.seqno] = true

	return nil
}

func parseTriple(jw *jsonw.Wrapper) (t *MerkleTriple, err error) {
	var seqno, l int
	var li LinkId
	var si *SigId

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
	} else if li, err = GetLinkId(jw.AtIndex(1)); err != nil {
		// noop
	} else if l == 2 {
		// noop
	} else {
		si, err = GetSigId(jw.AtIndex(2), false)
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
func parseV2(jw *jsonw.Wrapper) (userp *MerkleUserLeaf, err error) {
	var l int
	user := MerkleUserLeaf{}

	if l, err = jw.Len(); err != nil {
		return
	}
	if l < 2 {
		err = fmt.Errorf("No public chain")
	} else if user.public, err = parseTriple(jw.AtIndex(1)); err != nil {
		// noop
	} else if l == 2 {
		// noop
	} else {
		user.private, err = parseTriple(jw.AtIndex(2))
	}

	if err == nil {
		userp = &user
	}
	return

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

func (vp *VerificationPath) Verify() (user *MerkleUserLeaf, err error) {

	curr := vp.root.rootHash
	uid_s := vp.uid.String()
	bpath := uid_s
	pos := 0
	last_typ := 0

	var juser *jsonw.Wrapper

	for i, step := range vp.path {
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

		last_typ, err = jw.AtKey("type").GetInt()
		if err != nil {
			err = fmt.Errorf("At level %d, failed to get a valid 'type'", i)
			break
		}

		if last_typ == MERKLE_TREE_NODE {
			if plen == 0 {
				err = fmt.Errorf("Empty prefix len at level=%d", i)
				return
			}
			curr, err = GetNodeHash(jw.AtKey("tab").AtKey(step.prefix))
			if err != nil {
				err = UserNotFoundError{vp.uid, err.Error()}
				break
			}
			juser = nil
		} else {
			juser, err = jw.AtKey("tab").AtKey(uid_s).ToArray()
			if err != nil {
				msg := fmt.Sprintf("Didn't find a leaf for user in tree: %s",
					err.Error())
				err = UserNotFoundError{vp.uid, msg}
				break
			}
		}
	}

	if err == nil && juser == nil {
		err = UserNotFoundError{vp.uid, "tree path didn't end in a leaf"}
	}

	if err == nil {
		// noop
	} else if _, ok := err.(UserNotFoundError); ok {
		G.Log.Debug(fmt.Sprintf("In checking Merkle tree: %s", err.Error()))
	} else {
		return
	}

	user, err = ParseMerkleUserLeaf(juser)

	return
}

func (mc *MerkleClient) LookupUser(q HttpArgs) (u *MerkleUserLeaf, err error) {

	G.Log.Debug("+ MerkleClient.LookupUser(%v)", q)

	var path *VerificationPath

	if err = mc.Init(); err != nil {
		return
	}

	if path, err = mc.LookupPath(q); err != nil {
		return
	}

	if err = mc.VerifyRoot(path.root); err != nil {
		return
	}

	if u, err = path.Verify(); err != nil {
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
		ret = mc.lastRoot.ToSigJson()
	}
	return
}
