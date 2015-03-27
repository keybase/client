package libkb

import (
	"fmt"
	"time"

	jsonw "github.com/keybase/go-jsonw"
)

type SigChain struct {
	uid        UID
	username   string
	chainLinks []*ChainLink
	idVerified bool
	allKeys    bool

	// If we've locally delegated a key, it won't be reflected in our
	// loaded chain, so we need to make a note of it here.
	localCki *ComputedKeyInfos

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

func (sc *SigChain) LocalDelegate(kf *KeyFamily, key GenericKey, sigId *SigId, signingKid KID, isSibkey bool) (err error) {

	cki := sc.localCki
	l := sc.GetLastLink()
	if cki == nil && l != nil && l.cki != nil {
		cki = l.cki.Copy()
	}
	if cki == nil {
		cki = NewComputedKeyInfos()
		cki.InsertLocalEldestKey(FOKID{Kid: signingKid})
	}

	// Update the current state
	sc.localCki = cki

	if sigId != nil {
		var zeroTime time.Time
		var fpStr string
		if fpp := key.GetFingerprintP(); fpp != nil {
			fpStr = fpp.String()
		}
		err = cki.Delegate(key.GetKid().String(), fpStr, NowAsKeybaseTime(0), *sigId, signingKid, signingKid, isSibkey, time.Unix(0, 0), zeroTime)
	}

	return
}

func (sc SigChain) GetComputedKeyInfos() (cki *ComputedKeyInfos) {

	cki = sc.localCki
	if cki == nil {
		if l := sc.GetLastLink(); l != nil {
			cki = l.cki
		}
	}
	return
}

func (sc SigChain) GetFutureChainTail() (ret *MerkleTriple) {
	now := time.Now()
	if sc.localChainTail != nil && now.Sub(sc.localChainUpdateTime) < SERVER_UPDATE_LAG {
		ret = sc.localChainTail
	}
	return
}

func reverse(links []*ChainLink) {
	for i, j := 0, len(links)-1; i < j; i, j = i+1, j-1 {
		links[i], links[j] = links[j], links[i]
	}
}

func first(links []*ChainLink) (ret *ChainLink) {
	if len(links) == 0 {
		return nil
	}
	return links[0]
}

func last(links []*ChainLink) (ret *ChainLink) {
	if len(links) == 0 {
		return nil
	}
	return links[len(links)-1]
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
	mt.Seqno = sc.GetLastKnownSeqno() + 1
	G.Log.Debug("| Bumping SigChain LastKnownSeqno to %d", mt.Seqno)
	sc.localChainTail = &mt
	sc.localChainUpdateTime = time.Now()
}

func (sc *SigChain) LoadFromServer(t *MerkleTriple) (dirtyTail *LinkSummary, err error) {

	low := sc.GetLastLoadedSeqno()
	uid_s := sc.uid.String()

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
			t.LinkId, int(t.Seqno))
		return
	}

	if tail != nil {
		dirtyTail = tail.ToLinkSummary()

		// If we've stored a `last` and it's less than the one
		// we just loaded, then nuke it.
		if sc.localChainTail != nil && sc.localChainTail.Less(*dirtyTail) {
			G.Log.Debug("| Clear cached last (%d < %d)", sc.localChainTail.Seqno, dirtyTail.seqno)
			sc.localChainTail = nil
			sc.localCki = nil
		}
	}

	sc.chainLinks = append(sc.chainLinks, links...)
	return
}

func (sc *SigChain) VerifyChain() (err error) {
	G.Log.Debug("+ SigChain::VerifyChain()")
	defer func() {
		G.Log.Debug("- SigChain::VerifyChain() -> %s", ErrToOk(err))
	}()
	for i := len(sc.chainLinks) - 1; i >= 0; i-- {
		curr := sc.chainLinks[i]
		if curr.chainVerified {
			break
		}
		if err = curr.VerifyLink(); err != nil {
			return
		}
		if i > 0 && !sc.chainLinks[i-1].id.Eq(curr.GetPrev()) {
			return fmt.Errorf("Chain mismatch at seqno=%d", curr.GetSeqno())
		}
		if err = curr.CheckNameAndId(sc.username, sc.uid); err != nil {
			return
		}
		curr.chainVerified = true
	}

	return
}

func (sc SigChain) GetCurrentTailTriple() (cli *MerkleTriple) {
	if l := sc.GetLastLink(); l != nil {
		tmp := l.ToMerkleTriple()
		cli = &tmp
	}
	return
}

func (sc SigChain) GetLastLoadedId() (ret LinkId) {
	if l := last(sc.chainLinks); l != nil {
		ret = l.id
	}
	return
}

func (sc SigChain) GetLastKnownId() (ret LinkId) {
	if sc.localChainTail != nil {
		ret = sc.localChainTail.LinkId
	} else {
		ret = sc.GetLastLoadedId()
	}
	return
}

func (sc SigChain) GetFirstLink() *ChainLink {
	return first(sc.chainLinks)
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
		ret = sc.localChainTail.Seqno
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

// LimitToKeyFamily takes the given sigchain and walks backwards,
// stopping at either the chain beginning or the first link that's
// not a member of the current KeyFamily
func (sc *SigChain) LimitToKeyFamily(kf *KeyFamily) (links []*ChainLink) {
	var fokid *FOKID
	if fokid = kf.GetEldest(); fokid == nil {
		return
	}
	return sc.LimitToEldestFOKID(*fokid)
}

// LimitToEldestFOKID takes the given sigchain and walks backward,
// stopping once it scrolls of the current FOKID.
func (sc *SigChain) LimitToEldestFOKID(fokid FOKID) (links []*ChainLink) {
	if sc.chainLinks == nil {
		return
	}
	l := len(sc.chainLinks)
	lastGood := l
	for i := l - 1; i >= 0; i-- {
		if sc.chainLinks[i].MatchEldestFOKID(fokid) {
			lastGood = i
		} else {
			break
		}
	}
	if lastGood == 0 {
		links = sc.chainLinks
	} else {
		links = sc.chainLinks[lastGood:]
	}
	return
}

// verifySubchain verifies the given subchain and outputs a yes/no answer
// on whether or not it's well-formed, and also yields ComputedKeyInfos for
// all keys found in the process, including those that are now retired.
func verifySubchain(kf KeyFamily, links []*ChainLink, un string) (cached bool, cki *ComputedKeyInfos, err error) {

	G.Log.Debug("+ verifySubchain")
	defer func() {
		G.Log.Debug("- verifySubchain -> %v, %s", cached, ErrToOk(err))
	}()

	if links == nil || len(links) == 0 {
		err = InternalError{"verifySubchain should never get an empty chain."}
		return
	}

	last := links[len(links)-1]
	if cki = last.GetSigCheckCache(); cki != nil {
		cached = true
		G.Log.Debug("Skipped verification (cached): %s", last.id)
		return
	}

	cki = NewComputedKeyInfos()
	ckf := ComputedKeyFamily{&kf, cki}

	var prev *ChainLink
	var prevFokid *FOKID

	first := true

	for _, link := range links {

		newFokid := link.ToFOKID()

		tcl, w := NewTypedChainLink(link)
		if w != nil {
			w.Warn()
		}

		G.Log.Debug("| Verify link: %s", link.id)

		if first {
			if err = ckf.InsertEldestLink(tcl, un); err != nil {
				return
			}
			first = false
		}

		if dlg := tcl.GetRole(); dlg == DLG_NONE {
		} else if _, err = link.VerifySigWithKeyFamily(ckf); err != nil {
			G.Log.Debug("| Failure in VerifySigWithKeyFamily: %s", err.Error())
			return
		} else if err = ckf.Delegate(tcl); err != nil {
			G.Log.Debug("| Failure in Delegate: %s", err.Error())
			return
		}

		if err = tcl.VerifyReverseSig(&kf); err != nil {
			G.Log.Debug("| Failure in VerifyReverseSig: %s", err.Error())
			return
		}

		if err = ckf.Revoke(tcl); err != nil {
			return
		}

		if err = ckf.UpdateDevices(tcl); err != nil {
			return
		}

		if prevFokid != nil && !prevFokid.Eq(newFokid) {
			_, err = prev.VerifySigWithKeyFamily(ckf)
		}

		if err != nil {
			return
		}

		prev = link
		prevFokid = &newFokid
	}

	// Always verify the last...
	if _, err = last.VerifySigWithKeyFamily(ckf); err == nil {
		last.PutSigCheckCache(cki)
	}

	return
}

func (sc *SigChain) VerifySigsAndComputeKeys(ckf *ComputedKeyFamily) (cached bool, err error) {

	cached = false
	uid_s := sc.uid.String()
	G.Log.Debug("+ VerifySigsAndComputeKeys for user %s", uid_s)
	defer func() {
		G.Log.Debug("- VerifySigsAndComputeKeys for user %s -> %s", uid_s, ErrToOk(err))
	}()

	if err = sc.VerifyChain(); err != nil {
		return
	}

	if ckf.kf == nil {
		G.Log.Debug("| VerifyWithKey short-circuit, since no Key available")
		return
	}

	links := sc.LimitToKeyFamily(ckf.kf)

	if links == nil || len(links) == 0 {
		G.Log.Debug("| Empty chain after we limited to KeyFamily %v", *ckf.kf)
		if ckf.kf.eldest != nil {
			eldestKey := ckf.kf.Sibkeys[ckf.kf.eldest.String()].key
			sc.localCki = NewComputedKeyInfos()
			sc.localCki.InsertServerEldestKey(eldestKey, sc.username)
		} else {
			G.Log.Debug("| No keys found after we limited to KeyFamily %v", *ckf.kf)
		}
		return
	}

	if cached, ckf.cki, err = verifySubchain(*ckf.kf, links, sc.username); err != nil {
		return
	}

	// We used to check for a self-signature of one's keybase username
	// here, but that doesn't make sense because we haven't accounted
	// for revocations.  We'll go it later, after reconstructing
	// the id_table.  See LoadUser in user.go and
	// https://github.com/keybase/go/issues/43

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
	ckf       ComputedKeyFamily
	dirtyTail *LinkSummary

	// The preloaded sigchain; maybe we're loading a user that already was
	// loaded, and here's the existing sigchain.
	preload *SigChain
}

//========================================================================

func (l *SigChainLoader) GetUidString() string {
	return l.user.GetUid().String()
}

func (l *SigChainLoader) LoadLastLinkIdFromStorage() (ls *LinkSummary, err error) {
	var w *jsonw.Wrapper
	w, err = G.LocalDb.Get(DbKey{Typ: l.chainType.DbType, Key: l.GetUidString()})
	if err != nil {
		G.Log.Debug("| Error loading last link: %s", err)
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
		G.Log.Debug("| Preload successful")
		cached = true
		src := l.preload.chainLinks
		l.links = make([]*ChainLink, len(src))
		copy(l.links, src)
	} else {
		G.Log.Debug("| Preload failed")
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

	// Load whatever the last fingerprint was in the chain if we're not loading
	// allKeys. We have to load something...  Note that we don't use l.fp
	// here (as we used to) since if the user used to have chainlinks, and then
	// removed their key, we still want to load their last chainlinks.
	var loadFokid *FOKID

	curr = ls.id
	var link *ChainLink

	for curr != nil && good_key {
		G.Log.Debug("| loading link; curr=%s", curr)
		if link, err = ImportLinkFromStorage(curr); err != nil {
			return
		}
		fokid2 := link.ToEldestFOKID()

		if loadFokid == nil {
			loadFokid = &fokid2
			G.Log.Debug("| Setting loadFokid=%s", fokid2)
		} else if !l.allKeys && loadFokid != nil && !loadFokid.Eq(fokid2) {
			good_key = false
			G.Log.Debug("| Stop loading at FOKID=%s (!= FOKID=%s)",
				loadFokid.String(), fokid2.String())
		}

		if good_key {
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

func (l *SigChainLoader) GetKeyFamily() (err error) {
	l.ckf.kf = l.user.GetKeyFamily()
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

	cli := sc.GetCurrentTailTriple()

	future := sc.GetFutureChainTail()
	Efn := NewServerChainError
	G.Log.Debug("+ CheckFreshness")
	a := Seqno(-1)
	b := Seqno(-1)

	if srv != nil {
		G.Log.Debug("| Server triple: %v", srv)
		b = srv.Seqno
	} else {
		G.Log.Debug("| Server triple=nil")
	}
	if cli != nil {
		G.Log.Debug("| Client triple: %v", cli)
		a = cli.Seqno
	} else {
		G.Log.Debug("| Client triple=nil")
	}
	if future != nil {
		G.Log.Debug("| Future triple: %v", future)
	} else {
		G.Log.Debug("| Future triple=nil")
	}

	if srv == nil && cli != nil {
		err = Efn("Server claimed not to have this user in its tree (we had v=%d)", cli.Seqno)
	} else if srv == nil {
	} else if b < 0 || a > b {
		err = Efn("Server version-rollback suspected: Local %d > %d", a, b)
	} else if b == a {
		G.Log.Debug("| Local chain version is up-to-date @ version %d", b)
		current = true
		if cli == nil {
			err = Efn("Failed to read last link for user")
		} else if !cli.LinkId.Eq(srv.LinkId) {
			err = Efn("The server returned the wrong sigchain tail")
		}
	} else {
		G.Log.Debug("| Local chain version is out-of-date: %d < %d", a, b)
		current = false
	}

	if current && future != nil && (cli == nil || cli.Seqno < future.Seqno) {
		G.Log.Debug("| Still need to reload, since locally, we know seqno=%d is last", future.Seqno)
		current = false
	}

	G.Log.Debug("- CheckFreshness (%s) -> (%v,%s)", sc.uid, current, ErrToOk(err))
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

func (l *SigChainLoader) VerifySigsAndComputeKeys() (err error) {

	if l.ckf.kf != nil {
		_, err = l.chain.VerifySigsAndComputeKeys(&l.ckf)
	}
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
	if err = l.GetKeyFamily(); err != nil {
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
	if current, err = l.CheckFreshness(); err != nil {
		return
	}
	if !current {
		stage("LoadFromServer")
		if err = l.LoadFromServer(); err != nil {
			return
		}
	}

	if !current {
	} else if l.chain.GetComputedKeyInfos() == nil {
		G.Log.Debug("| Need to reverify chain since we don't have ComputedKeyInfos")
	} else {
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
	if err = l.VerifySigsAndComputeKeys(); err != nil {
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
