package libkb

import (
	"fmt"
	"github.com/keybase/go-jsonw"
)

type SigChain struct {
	uid      UID
	username string

	chainLinks     []*ChainLink
	pgpFingerprint *PgpFingerprint

	sigVerified bool
	idVerified  bool
}

func (sc SigChain) Len() int {
	return len(sc.chainLinks)
}

func reverse(links []*ChainLink) {
	for i, j := 0, len(links)-1; i < j; i, j = i+1, j-1 {
		links[i], links[j] = links[j], links[i]
	}
}

func last(links []*ChainLink) (ret *ChainLink) {
	if links != nil {
		ret = links[len(links)-1]
	}
	return
}

func (sc *SigChain) LoadFromServer(t *MerkleTriple) (err error) {

	low := sc.GetLastSeqno()
	uid_s := sc.uid.ToString()

	G.Log.Debug("+ Load SigChain from server (uid=%s, low=%d)", uid_s, low)
	defer G.Log.Debug("- Loaded SigChain -> %s", ErrToOk(err))

	res, err := G.API.Get(ApiArg{
		Endpoint:    "sig/get",
		NeedSession: false,
		Args: HttpArgs{
			"uid": S{uid_s},
			"low": I{int(low)},
		},
	})

	if err != nil {
		return err
	}

	v := res.Body.AtKey("sigs")
	var lim int
	if lim, err = v.Len(); err != nil {
		return err
	}

	found_tail := false

	G.Log.Debug("| Got back %d new entries", lim)

	var links []*ChainLink
	for i := 0; i < lim; i++ {
		var link *ChainLink
		if link, err = ImportLinkFromServer(sc, v.AtIndex(i)); err != nil {
			return
		}
		if link.GetSeqno() <= low {
			continue
		}
		links = append(links, link)
		if !found_tail && t == nil {
			if found_tail, err = link.checkAgainstMerkleTree(t); err != nil {
				return
			}
		}
	}

	if t != nil && !found_tail {
		err = NewServerChainError("Failed to reach seqno=%d in server response",
			int(t.seqno))
		return
	}

	sc.chainLinks = append(sc.chainLinks, links...)
	return
}

func (sc *SigChain) VerifyChain() error {
	for i := len(sc.chainLinks) - 1; i >= 0; i-- {
		curr := sc.chainLinks[i]
		if curr.chainVerified {
			break
		}
		if err := curr.VerifyLink(); err != nil {
			return err
		}
		if i > 0 && !sc.chainLinks[i-1].id.Eq(curr.GetPrev()) {
			return fmt.Errorf("Chain mismatch at seqno=%d", curr.GetSeqno())
		}
		if err := curr.CheckNameAndId(sc.username, sc.uid); err != nil {
			return err
		}
		curr.chainVerified = true
	}

	return nil
}

func (sc SigChain) GetLastId() (ret LinkId) {
	if l := last(sc.chainLinks); l != nil {
		ret = l.id
	}
	return
}

func (sc SigChain) GetLastLink() *ChainLink {
	return last(sc.chainLinks)
}

func (sc SigChain) GetLastSeqno() (ret Seqno) {
	if l := last(sc.chainLinks); l != nil {
		ret = l.GetSeqno()
	}
	return
}

func (sc *SigChain) Prune(allKeys bool) {
	if sc.pgpFingerprint != nil && sc.chainLinks != nil {
		fp := *sc.pgpFingerprint
		i := len(sc.chainLinks) - 1

		for ; i >= 0; i-- {
			link := sc.chainLinks[i]
			if !link.MatchFingerprintAndMark(fp) && !allKeys {
				break
			}
		}
		i++
		sc.chainLinks = sc.chainLinks[i:]
	}
}

func (sc *SigChain) Store() (err error) {
	for i := len(sc.chainLinks) - 1; i >= 0; i-- {
		link := sc.chainLinks[i]
		var didStore bool
		if didStore, err = link.Store(); err != nil || !didStore {
			return
		}
	}
	return nil
}

func (sc *SigChain) verifyId(fp PgpFingerprint) (good bool, searched bool) {

	var fp_mismatch, search, ok bool

	if sc.chainLinks != nil {
		for i := len(sc.chainLinks) - 1; i >= 0; i-- {
			cl := sc.chainLinks[i]
			if !cl.MatchFingerprint(fp) {
				fp_mismatch = true
				break
			}
			search = true
			if ok = cl.MatchUidAndUsername(sc.uid, sc.username); ok {
				return true, true
			}
		}
	}

	return false, search
}

func (sc *SigChain) VerifyId(key *PgpKeyBundle) error {

	if sc.idVerified {
		return nil
	}

	fp := key.GetFingerprint()

	good, searched := sc.verifyId(fp)
	if good {
		sc.idVerified = true
		return nil
	}

	if !searched && key.FindKeybaseUsername(sc.username) {
		sc.idVerified = true
		return nil
	}

	return fmt.Errorf("No proof of UID %s for user %s w/ key %s",
		sc.uid.ToString(), sc.username, fp.ToString())
}

func (sc *SigChain) VerifyWithKey(key *PgpKeyBundle) (cached bool, err error) {

	cached = false
	uid_s := sc.uid.ToString()
	G.Log.Debug("+ VerifyWithKey for user %s", uid_s)

	if sc.sigVerified {
		cached = true
		return
	}

	if err = sc.VerifyChain(); err != nil {
		return
	}

	if key == nil {
		G.Log.Debug("| VerifyWithKey short-circuit, since no Key available")
		return
	}

	if err = sc.VerifyId(key); err != nil {
		return
	}

	if last := sc.GetLastLink(); last != nil {
		cached, err = last.VerifySig(*key)
	}

	if err == nil {
		sc.sigVerified = true
	}

	G.Log.Debug("- VerifyWithKey for user %s -> %v", uid_s, (err == nil))

	return
}

//========================================================================

type ChainType struct {
	DbType          ObjType
	Private         bool
	Encrypted       bool
	GetMerkleTriple func(u *MerkleUserLeaf) *MerkleTriple
}

var PublicChain *ChainType = &ChainType{
	DbType:          DB_SIG_CHAIN_TAIL_PUBLIC,
	Private:         false,
	Encrypted:       false,
	GetMerkleTriple: func(u *MerkleUserLeaf) *MerkleTriple { return u.public },
}

//========================================================================

type SigChainLoader struct {
	user      *User
	allKeys   bool
	leaf      *MerkleUserLeaf
	chain     *SigChain
	chainType *ChainType
	links     []*ChainLink
	fp        *PgpFingerprint
}

//========================================================================

func (l *SigChainLoader) GetUidString() string {
	return l.user.GetUid().ToString()
}

func (l *SigChainLoader) LoadLastLinkIdFromStorage() (id LinkId, err error) {
	var w *jsonw.Wrapper
	w, err = G.LocalDb.Get(DbKey{Typ: l.chainType.DbType, Key: l.GetUidString()})
	if err == nil {
		id, err = GetLinkId(w)
	}
	return
}

func (l *SigChainLoader) LoadLinksFromStorage() (err error) {
	var curr LinkId
	var links []*ChainLink
	good_key := true

	uid_s := l.GetUidString()

	G.Log.Debug("+ SigChainLoader.LoadFromStorage(%s)", uid_s)
	defer G.Log.Debug("- SigChainLoader.LoadFromStorage(%s) -> %s", uid_s, ErrToOk(err))

	if curr, err = l.LoadLastLinkIdFromStorage(); err != nil || curr == nil {
		return err
	}

	if l.fp == nil && !l.allKeys {
		return
	}

	var link *ChainLink

	for curr != nil && good_key {
		G.Log.Debug("| loading link; curr=%s", curr.ToString())
		if link, err = ImportLinkFromStorage(curr); err != nil {
			return
		} else if fp2 := link.GetPgpFingerprint(); !l.allKeys && l.fp != nil && !l.fp.Eq(fp2) {
			good_key = false
			G.Log.Debug("| Stop loading at fp=%s (!= fp=%s)", l.fp.ToString(), fp2.ToString())
		} else {
			links = append(links, link)
			curr = link.GetPrev()
		}
	}

	// Do a list-reverse
	reverse(links)

	l.links = links
	return
}

//========================================================================

func (l *SigChainLoader) MakeSigChain() error {
	q := 0
	sc := &SigChain{
		uid:            l.user.GetUid(),
		username:       l.user.GetName(),
		chainLinks:     l.links,
		pgpFingerprint: l.fp,
	}
	for _, l := range l.links {
		l.parent = sc
	}
	l.chain = sc
	return nil
}

//========================================================================

func (l *SigChainLoader) GetFingerprint() (err error) {
	l.fp, err = l.user.GetActivePgpFingerprint()
	return
}

//========================================================================

func (l *SigChainLoader) GetMerkleTriple() (ret *MerkleTriple) {
	if l.leaf != nil {
		ret = l.chainType.GetMerkleTriple(l.leaf)
	}
	return
}

//========================================================================

func (sc *SigChain) CheckFreshness(t *MerkleTriple) (current bool, err error) {
	current = false
	a := sc.GetLastSeqno()
	Efn := NewServerChainError
	if t == nil && a > 0 {
		err = Efn("Server claimed not to have this user in its tree (we had v=%d)", a)
	} else if t == nil {
	} else if b := t.seqno; b < 0 || a > b {
		err = Efn("Server version-rollback sustpected: Local %d > %d", a, b)
	} else if b == a {
		G.Log.Debug("| Local chain version is up-to-date @ version %d", b)
		current = true
		if last := sc.GetLastId(); last == nil {
			err = Efn("Failed to read last link for user")
		} else if !last.Eq(t.linkId) {
			err = Efn("The server returned the wrong sigchain tail")
		}
	} else {
		G.Log.Debug("| Local chain version is out-of-date: %d < %d", a, b)
		current = false
	}
	G.Log.Debug("| CheckFreshness (%s) -> (%v,%s)", sc.uid.ToString(), current, ErrToOk(err))
	return
}

//========================================================================

func (l *SigChainLoader) CheckFreshness() (current bool, err error) {
	return l.chain.CheckFreshness(l.GetMerkleTriple())
}
func (l *SigChainLoader) LoadFromServer() (err error) {
	return l.chain.LoadFromServer(l.GetMerkleTriple())
}

//========================================================================

func (l *SigChainLoader) Load() (ret *SigChain, err error) {
	var current bool

	if err = l.GetFingerprint(); err != nil {
		return
	}
	if err = l.LoadLinksFromStorage(); err != nil {
		return
	}
	if err = l.MakeSigChain(); err != nil {
		return
	}
	if err = l.chain.VerifyChain(); err != nil {
		return
	}
	if current, err = l.CheckFreshness(); err != nil || current {
		return
	}
	if err = l.LoadFromServer(); err != nil {
		return
	}
	if err = l.chain.VerifyChain(); err != nil {
		return
	}
	if err = l.chain.Store(); err != nil {
		return
	}
	return
}

//========================================================================

func LoadSigChain(u *User, allKeys bool, f *MerkleUserLeaf, t *ChainType) (ret *SigChain, err error) {
	loader := SigChainLoader{user: u, allKeys: allKeys, leaf: f, chainType: t}
	return loader.Load()
}

//========================================================================
