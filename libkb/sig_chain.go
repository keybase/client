package libkb

import (
	"fmt"
	"github.com/keybase/go-jsonw"
	"time"
)

type SigChain struct {
	uid        UID
	username   string
	chainLinks []*ChainLink
	idVerified bool
	allKeys    bool

	// If we've made local modifications to our chain, mark it here;
	// there's a slight lag on the server and we might not get the
	// new chain tail if we query the server right after an update.
	localChainTail *MerkleTriple

	// When the local chain was updated.
	localChainUpdateTime time.Time
}

func (sc SigChain) Len() int {
	return len(sc.chainLinks)
}

func (sc SigChain) GetCheckableChainTail() (ret *MerkleTriple) {
	now := time.Now()
	if sc.localChainTail != nil && now.Sub(sc.localChainUpdateTime) < SERVER_UPDATE_LAG {
		ret = sc.localChainTail
	} else if link := sc.GetLastLink(); link != nil {
		tmp := link.ToMerkleTriple()
		ret = &tmp
	}
	return
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

func (sc *SigChain) VerifiedChainLinks(fp PgpFingerprint) (ret []*ChainLink) {
	last := sc.GetLastLink()
	if last == nil || !last.sigVerified {
		return
	}
	start := -1
	for i := len(sc.chainLinks) - 1; i >= 0 && sc.chainLinks[i].MatchFingerprint(fp); i-- {
		start = i
	}
	if start >= 0 {
		ret = sc.chainLinks[start:]
	}
	return
}

func (sc *SigChain) Bump(mt MerkleTriple) {
	mt.seqno = sc.GetLastKnownSeqno() + 1
	G.Log.Debug("| Bumping SigChain LastKnownSeqno to %d", mt.seqno)
	sc.localChainTail = &mt
	sc.localChainUpdateTime = time.Now()
}

func (sc *SigChain) LoadFromServer(t *MerkleTriple) (dirtyTail *LinkSummary, err error) {

	low := sc.GetLastLoadedSeqno()
	uid_s := sc.uid.ToString()

	G.Log.Debug("+ Load SigChain from server (uid=%s, low=%d)", uid_s, low)
	defer func() { G.Log.Debug("- Loaded SigChain -> %s", ErrToOk(err)) }()

	res, err := G.API.Get(ApiArg{
		Endpoint:    "sig/get",
		NeedSession: false,
		Args: HttpArgs{
			"uid": S{uid_s},
			"low": I{int(low)},
		},
	})

	if err != nil {
		return
	}

	v := res.Body.AtKey("sigs")
	var lim int
	if lim, err = v.Len(); err != nil {
		return
	}

	found_tail := false

	G.Log.Debug("| Got back %d new entries", lim)

	var links []*ChainLink
	var tail *ChainLink

	for i := 0; i < lim; i++ {
		var link *ChainLink
		if link, err = ImportLinkFromServer(sc, v.AtIndex(i)); err != nil {
			return
		}
		if link.GetSeqno() <= low {
			continue
		}
		links = append(links, link)
		if !found_tail && t != nil {
			if found_tail, err = link.checkAgainstMerkleTree(t); err != nil {
				return
			}
		}
		tail = link
	}

	if t != nil && !found_tail {
		err = NewServerChainError("Failed to reach (%s, %d) in server response",
			t.linkId.ToString(), int(t.seqno))
		return
	}

	if tail != nil {
		dirtyTail = tail.ToLinkSummary()

		// If we've stored a `last` and it's less than the one
		// we just loaded, then nuke it.
		if sc.localChainTail != nil && sc.localChainTail.Less(*dirtyTail) {
			G.Log.Debug("| Clear cached last (%d < %d)", sc.localChainTail.seqno, dirtyTail.seqno)
			sc.localChainTail = nil
		}
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

func (sc SigChain) GetLastLoadedId() (ret LinkId) {
	if l := last(sc.chainLinks); l != nil {
		ret = l.id
	}
	return
}

func (sc SigChain) GetLastKnownId() (ret LinkId) {
	if sc.localChainTail != nil {
		ret = sc.localChainTail.linkId
	} else {
		ret = sc.GetLastLoadedId()
	}
	return
}

func (sc SigChain) GetLastLink() *ChainLink {
	return last(sc.chainLinks)
}

func (sc SigChain) GetLastKnownSeqno() (ret Seqno) {
	G.Log.Debug("+ GetLastKnownSeqno()")
	defer func() {
		G.Log.Debug("- GetLastKnownSeqno() -> %d", ret)
	}()
	if sc.localChainTail != nil {
		G.Log.Debug("| Cached in last summary object...")
		ret = sc.localChainTail.seqno
	} else {
		ret = sc.GetLastLoadedSeqno()
	}
	return
}

func (sc SigChain) GetLastLoadedSeqno() (ret Seqno) {
	G.Log.Debug("+ GetLastLoadedSeqno()")
	defer func() {
		G.Log.Debug("- GetLastLoadedSeqno() -> %d", ret)
	}()
	if l := last(sc.chainLinks); l != nil {
		G.Log.Debug("| Fetched from main chain")
		ret = l.GetSeqno()
	}
	return
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

	var search, ok bool

	if sc.chainLinks != nil {
		for i := len(sc.chainLinks) - 1; i >= 0; i-- {
			cl := sc.chainLinks[i]
			if !cl.MatchFingerprint(fp) {
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
	dirtyTail *LinkSummary

	// The preloaded sigchain; maybe we're loading a user that already was
	// loaded, and here's the existing sigchain.
	preload *SigChain
}

//========================================================================

func (l *SigChainLoader) GetUidString() string {
	return l.user.GetUid().ToString()
}

func (l *SigChainLoader) LoadLastLinkIdFromStorage() (ls *LinkSummary, err error) {
	var w *jsonw.Wrapper
	w, err = G.LocalDb.Get(DbKey{Typ: l.chainType.DbType, Key: l.GetUidString()})
	if err != nil {
		G.Log.Debug("| Error loading last link: %s", err.Error())
	} else if w == nil {
		G.Log.Debug("| LastLinkId was null")
	} else {
		if ls, err = GetLinkSummary(w); err == nil {
			G.Log.Debug("| LastLinkID loaded as %v", *ls)
		}
	}
	return
}

func (l *SigChainLoader) AccessPreload() (cached bool, err error) {
	if l.preload != nil && (l.preload.allKeys == l.allKeys) {
		cached = true
		src := l.preload.chainLinks
		l.links = make([]*ChainLink, len(src))
		copy(l.links, src)
	}
	return
}

func (l *SigChainLoader) LoadLinksFromStorage() (err error) {
	var curr LinkId
	var links []*ChainLink
	var ls *LinkSummary
	good_key := true

	uid_s := l.GetUidString()

	G.Log.Debug("+ SigChainLoader.LoadFromStorage(%s)", uid_s)
	defer func() { G.Log.Debug("- SigChainLoader.LoadFromStorage(%s) -> %s", uid_s, ErrToOk(err)) }()

	if ls, err = l.LoadLastLinkIdFromStorage(); err != nil || ls == nil {
		G.Log.Debug("| Failed to load last link ID")
		return err
	}

	if l.fp == nil && !l.allKeys {
		G.Log.Debug("| Current fingerprint is nil; short-circuiting local load")
		return
	}

	curr = ls.id
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

	reverse(links)

	l.links = links
	return
}

//========================================================================

func (l *SigChainLoader) MakeSigChain() error {
	sc := &SigChain{
		uid:        l.user.GetUid(),
		username:   l.user.GetName(),
		chainLinks: l.links,
		allKeys:    l.allKeys,
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

func (sc *SigChain) CheckFreshness(srv *MerkleTriple) (current bool, err error) {
	current = false
	cli := sc.GetCheckableChainTail()
	Efn := NewServerChainError
	G.Log.Debug("+ CheckFreshness")
	a := Seqno(-1)
	b := Seqno(-1)
	if srv != nil {
		G.Log.Debug("| Server triple: %v", srv)
		b = srv.seqno
	} else {
		G.Log.Debug("| Server triple=nil")
	}
	if cli != nil {
		G.Log.Debug("| Client triple: %v", cli)
		a = cli.seqno
	} else {
		G.Log.Debug("| Client client=nil")
	}

	if srv == nil && cli != nil {
		err = Efn("Server claimed not to have this user in its tree (we had v=%d)", cli.seqno)
	} else if srv == nil {
	} else if b < 0 || a > b {
		err = Efn("Server version-rollback sustpected: Local %d > %d", a, b)
	} else if b == a {
		G.Log.Debug("| Local chain version is up-to-date @ version %d", b)
		current = true
		if cli == nil {
			err = Efn("Failed to read last link for user")
		} else if !cli.linkId.Eq(srv.linkId) {
			err = Efn("The server returned the wrong sigchain tail")
		}
	} else {
		G.Log.Debug("| Local chain version is out-of-date: %d < %d", a, b)
		current = false
	}

	k := sc.GetLastKnownSeqno()
	if current && ((srv != nil && srv.seqno < k) || (srv == nil && k > 0)) {
		G.Log.Debug("| Still need to reload, since locally, we know seqno=%d is last", k)
		current = false
	}

	G.Log.Debug("- CheckFreshness (%s) -> (%v,%s)", sc.uid.ToString(), current, ErrToOk(err))
	return
}

//========================================================================

func (l *SigChainLoader) CheckFreshness() (current bool, err error) {
	return l.chain.CheckFreshness(l.GetMerkleTriple())
}

//========================================================================

func (l *SigChainLoader) LoadFromServer() (err error) {
	srv := l.GetMerkleTriple()
	l.dirtyTail, err = l.chain.LoadFromServer(srv)
	return
}

//========================================================================

func (l *SigChainLoader) VerifySig() (err error) {
	var key *PgpKeyBundle

	if l.fp == nil {
		return
	}
	if key, err = l.user.GetActiveKey(); err != nil {
		return
	}
	if err = key.CheckFingerprint(l.fp); err != nil {
		return
	}

	_, err = l.chain.VerifyWithKey(key)

	return
}

//========================================================================

func (l *SigChainLoader) StoreTail() (err error) {
	if l.dirtyTail == nil {
		return
	}
	err = G.LocalDb.Put(
		DbKey{Typ: l.chainType.DbType, Key: l.GetUidString()},
		nil,
		l.dirtyTail.ToJson(),
	)
	G.Log.Debug("| Storing dirtyTail @ %d", l.dirtyTail.seqno)
	if err == nil {
		l.dirtyTail = nil
	}
	return
}

//========================================================================

func (l *SigChainLoader) Store() (err error) {
	err = l.StoreTail()
	if err == nil {
		err = l.chain.Store()
	}
	return
}

//========================================================================

func (l *SigChainLoader) Load() (ret *SigChain, err error) {
	var current bool
	var preload bool

	uid_s := l.GetUidString()

	G.Log.Debug("+ SigChainLoader.Load(%s)", uid_s)
	defer func() {
		G.Log.Debug("- SigChainLoader.Load(%s) -> (%v, %s)", uid_s, (ret != nil), ErrToOk(err))
	}()

	stage := func(s string) {
		G.Log.Debug("| SigChainLoader.Load(%s) %s", uid_s, s)
	}

	stage("GetFingerprint")
	if err = l.GetFingerprint(); err != nil {
		return
	}

	stage("AccessPreload")
	if preload, err = l.AccessPreload(); err != nil {
		return
	}

	if !preload {
		stage("LoadLinksFromStorage")
		if err = l.LoadLinksFromStorage(); err != nil {
			return
		}
	}

	stage("MakeSigChain")
	if err = l.MakeSigChain(); err != nil {
		return
	}
	ret = l.chain
	stage("VerifyChain")
	if err = l.chain.VerifyChain(); err != nil {
		return
	}
	stage("CheckFreshness")
	if current, err = l.CheckFreshness(); err != nil || current {
		return
	}
	stage("LoadFromServer")
	if err = l.LoadFromServer(); err != nil {
		return
	}
	stage("VerifyChain")
	if err = l.chain.VerifyChain(); err != nil {
		return
	}
	stage("Store")
	if err = l.chain.Store(); err != nil {
		return
	}
	stage("VerifySig")
	if err = l.VerifySig(); err != nil {
		return
	}
	stage("Store")
	if err = l.Store(); err != nil {
		return
	}

	return
}

//========================================================================

func LoadSigChain(u *User, allKeys bool, f *MerkleUserLeaf, t *ChainType, preload *SigChain) (ret *SigChain, err error) {
	loader := SigChainLoader{user: u, allKeys: allKeys, leaf: f, chainType: t, preload: preload}
	return loader.Load()
}

//========================================================================
