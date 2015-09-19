package libkb

import (
	"fmt"
	"io"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
)

type SigChain struct {
	uid        keybase1.UID
	username   NormalizedUsername
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

	Contextified
}

func (sc SigChain) Len() int {
	return len(sc.chainLinks)
}

func (sc *SigChain) LocalDelegate(kf *KeyFamily, key GenericKey, sigID keybase1.SigID, signingKid keybase1.KID, isSibkey bool) (err error) {

	cki := sc.localCki
	l := sc.GetLastLink()
	if cki == nil && l != nil && l.cki != nil {
		// TODO: Figure out whether this needs to be a deep copy. See
		// https://github.com/keybase/client/issues/414 .
		cki = l.cki.ShallowCopy()
	}
	if cki == nil {
		G.Log.Debug("LocalDelegate: creating new cki (signingKid: %s)", signingKid)
		cki = NewComputedKeyInfos()
		cki.InsertLocalEldestKey(signingKid)
	}

	// Update the current state
	sc.localCki = cki

	if len(sigID) > 0 {
		var zeroTime time.Time
		err = cki.Delegate(key.GetKID(), NowAsKeybaseTime(0), sigID, signingKid, signingKid, "" /* pgpHash */, isSibkey, time.Unix(0, 0), zeroTime)
	}

	return
}

func (sc SigChain) GetComputedKeyInfos() (cki *ComputedKeyInfos) {
	cki = sc.localCki
	if cki == nil {
		if l := sc.GetLastLink(); l != nil {
			if l.cki == nil {
				G.Log.Debug("GetComputedKeyInfos: l.cki is nil")
			}
			cki = l.cki
		}
	}
	return
}

func (sc SigChain) GetFutureChainTail() (ret *MerkleTriple) {
	now := time.Now()
	if sc.localChainTail != nil && now.Sub(sc.localChainUpdateTime) < ServerUpdateLag {
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

func (sc *SigChain) VerifiedChainLinks(fp PGPFingerprint) (ret []*ChainLink) {
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

func (sc *SigChain) LoadFromServer(t *MerkleTriple, selfUID keybase1.UID) (dirtyTail *MerkleTriple, loadedFromHead bool, err error) {
	low := sc.GetLastLoadedSeqno()
	loadedFromHead = (low == Seqno(0) || low == Seqno(-1))

	G.Log.Debug("+ Load SigChain from server (uid=%s, low=%d)", sc.uid, low)
	defer func() { G.Log.Debug("- Loaded SigChain -> %s", ErrToOk(err)) }()

	res, err := G.API.Get(APIArg{
		Endpoint:    "sig/get",
		NeedSession: false,
		Args: HTTPArgs{
			"uid": UIDArg(sc.uid),
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

	foundTail := false

	G.Log.Debug("| Got back %d new entries", lim)

	var links []*ChainLink
	var tail *ChainLink

	for i := 0; i < lim; i++ {
		var link *ChainLink
		if link, err = ImportLinkFromServer(sc, v.AtIndex(i), selfUID); err != nil {
			return
		}
		if link.GetSeqno() <= low {
			continue
		}
		links = append(links, link)
		if !foundTail && t != nil {
			if foundTail, err = link.checkAgainstMerkleTree(t); err != nil {
				return
			}
		}
		tail = link
	}

	if t != nil && !foundTail {
		err = NewServerChainError("Failed to reach (%s, %d) in server response",
			t.LinkID, int(t.Seqno))
		return
	}

	if tail != nil {
		dirtyTail = tail.ToMerkleTriple()

		// If we've stored a `last` and it's less than the one
		// we just loaded, then nuke it.
		if sc.localChainTail != nil && sc.localChainTail.Less(*dirtyTail) {
			G.Log.Debug("| Clear cached last (%d < %d)", sc.localChainTail.Seqno, dirtyTail.Seqno)
			sc.localChainTail = nil
			sc.localCki = nil
		}
	}

	sc.chainLinks = append(sc.chainLinks, links...)
	return
}

func (sc *SigChain) getFirstSeqno() (ret Seqno) {
	if len(sc.chainLinks) > 0 {
		ret = sc.chainLinks[0].GetSeqno()
	}
	return ret
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
		if i > 0 {
			prev := sc.chainLinks[i-1]
			if !prev.id.Eq(curr.GetPrev()) {
				return ChainLinkPrevHashMismatchError{fmt.Sprintf("Chain mismatch at seqno=%d", curr.GetSeqno())}
			}
			if prev.GetSeqno()+1 != curr.GetSeqno() {
				return ChainLinkWrongSeqnoError{fmt.Sprintf("Chain seqno mismatch at seqno=%d (previous=%d)", curr.GetSeqno(), prev.GetSeqno())}
			}
		}
		if err = curr.CheckNameAndID(sc.username, sc.uid); err != nil {
			return
		}
		curr.chainVerified = true
	}

	return
}

func (sc SigChain) GetCurrentTailTriple() (ret *MerkleTriple) {
	if l := sc.GetLastLink(); l != nil {
		ret = l.ToMerkleTriple()
	}
	return
}

func (sc SigChain) GetLastLoadedID() (ret LinkID) {
	if l := last(sc.chainLinks); l != nil {
		ret = l.id
	}
	return
}

func (sc SigChain) GetLastKnownID() (ret LinkID) {
	if sc.localChainTail != nil {
		ret = sc.localChainTail.LinkID
	} else {
		ret = sc.GetLastLoadedID()
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

// LimitToEldestKID takes the given sigchain and walks backward,
// stopping once it scrolls off the current KID.
func (sc *SigChain) LimitToEldestKID(eldest keybase1.KID) (links []*ChainLink, err error) {
	if sc.chainLinks == nil {
		return
	}
	l := len(sc.chainLinks)
	lastGood := l
	for i := l - 1; i >= 0; i-- {
		if sc.chainLinks[i].ToEldestKID().Equal(eldest) {
			lastGood = i
		} else {
			break
		}
	}

	// The eldest KID *must* refer to the latest subchain. Make sure there
	// are no earlier matching subchains.
	for i := lastGood - 1; i >= 0; i-- {
		if sc.chainLinks[i].ToEldestKID().Equal(eldest) {
			return nil, NotLatestSubchainError{"The eldest key's subchain must always be at the end."}
		}
	}

	if lastGood == 0 {
		links = sc.chainLinks
	} else {
		links = sc.chainLinks[lastGood:]
	}
	return
}

// Dump prints the sigchain to the writer arg.
func (sc *SigChain) Dump(w io.Writer) {
	fmt.Fprintf(w, "sigchain dump\n")
	for i, l := range sc.chainLinks {
		fmt.Fprintf(w, "link %d: %+v\n", i, l)
	}
	fmt.Fprintf(w, "last known seqno: %d\n", sc.GetLastKnownSeqno())
	fmt.Fprintf(w, "last known id: %s\n", sc.GetLastKnownID())
}

// verifySubchain verifies the given subchain and outputs a yes/no answer
// on whether or not it's well-formed, and also yields ComputedKeyInfos for
// all keys found in the process, including those that are now retired.
func (sc *SigChain) verifySubchain(kf KeyFamily, links []*ChainLink) (cached bool, cki *ComputedKeyInfos, err error) {
	un := sc.username

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
	ckf := ComputedKeyFamily{kf: &kf, cki: cki, Contextified: sc.Contextified}

	first := true

	for linkIndex, link := range links {
		if isBad, reason := link.IsBad(); isBad {
			G.Log.Debug("Ignoring bad chain link with sig ID %s: %s", link.GetSigID(), reason)
			continue
		}

		newKID := link.GetKID()

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

		// Optimization: When several links in a row are signed by the same
		// key, we only validate the signature of the last of that group.
		// (Unless a link delegates new keys, in which case we always check.)
		// Note that we do this *before* processing revocations in the key
		// family. That's important because a chain link might revoke the same
		// key that signed it.
		isDelegating := (tcl.GetRole() != DLGNone)
		isModifyingKeys := isDelegating || tcl.Type() == PGPUpdateType
		isFinalLink := (linkIndex == len(links)-1)
		isLastLinkInSameKeyRun := (isFinalLink || newKID != links[linkIndex+1].GetKID())
		if isModifyingKeys || isFinalLink || isLastLinkInSameKeyRun {
			_, err = link.VerifySigWithKeyFamily(ckf)
			if err != nil {
				G.Log.Debug("| Failure in VerifySigWithKeyFamily: %s", err)
				return
			}
		}

		if isDelegating {
			err = ckf.Delegate(tcl)
			if err != nil {
				G.Log.Debug("| Failure in Delegate: %s", err)
				return
			}
		}

		if pgpcl, ok := tcl.(*PGPUpdateChainLink); ok {
			if hash := pgpcl.GetPGPFullHash(); hash != "" {
				G.Log.Debug("| Setting active PGP hash for %s: %s", pgpcl.kid, hash)
				ckf.SetActivePGPHash(pgpcl.kid, hash)
			}
		}

		if err = tcl.VerifyReverseSig(ckf); err != nil {
			G.Log.Debug("| Failure in VerifyReverseSig: %s", err)
			return
		}

		if err = ckf.Revoke(tcl); err != nil {
			return
		}

		if err = ckf.UpdateDevices(tcl); err != nil {
			return
		}

		if err != nil {
			return
		}
	}

	last.PutSigCheckCache(cki)
	return
}

// CheckChainStartsAtOne checks that the sigchain starts at link Seqno=1
func (sc *SigChain) CheckChainStartsAtOne() (err error) {
	first := sc.getFirstSeqno()
	if first > Seqno(1) {
		err = ChainLinkWrongSeqnoError{fmt.Sprintf("Wanted a chain from seqno=1, but got seqno=%d", first)}
	}
	return
}

func (sc *SigChain) VerifySigsAndComputeKeys(eldest keybase1.KID, ckf *ComputedKeyFamily, needStartAtOneCheck bool) (cached bool, err error) {

	cached = false
	G.Log.Debug("+ VerifySigsAndComputeKeys for user %s (eldest = %s)", sc.uid, eldest)
	defer func() {
		G.Log.Debug("- VerifySigsAndComputeKeys for user %s -> %s", sc.uid, ErrToOk(err))
	}()

	if err = sc.VerifyChain(); err != nil {
		return
	}

	if needStartAtOneCheck {
		if err = sc.CheckChainStartsAtOne(); err != nil {
			return
		}
	}

	if ckf.kf == nil || eldest.IsNil() {
		G.Log.Debug("| VerifyWithKey short-circuit, since no Key available")
		return
	}
	links, err := sc.LimitToEldestKID(eldest)
	if err != nil {
		return
	}

	if links == nil || len(links) == 0 {
		G.Log.Debug("| Empty chain after we limited to eldest %s", eldest)
		eldestKey, _ := ckf.FindKeyWithKIDUnsafe(eldest)
		sc.localCki = NewComputedKeyInfos()
		err = sc.localCki.InsertServerEldestKey(eldestKey, sc.username)
		ckf.cki = sc.localCki
		return
	}

	if cached, ckf.cki, err = sc.verifySubchain(*ckf.kf, links); err != nil {
		return
	}

	// We used to check for a self-signature of one's keybase username
	// here, but that doesn't make sense because we haven't accounted
	// for revocations.  We'll go it later, after reconstructing
	// the id_table.  See LoadUser in user.go and
	// https://github.com/keybase/go/issues/43

	return
}

func (sc *SigChain) GetLinkFromSeqno(seqno int) *ChainLink {
	for _, link := range sc.chainLinks {
		if link.GetSeqno() == Seqno(seqno) {
			return link
		}
	}
	return nil
}

func (sc *SigChain) GetLinkFromSigID(id keybase1.SigID) *ChainLink {
	for _, link := range sc.chainLinks {
		if link.GetSigID().Equal(id) {
			return link
		}
	}
	return nil
}

//========================================================================

type ChainType struct {
	DbType          ObjType
	Private         bool
	Encrypted       bool
	GetMerkleTriple func(u *MerkleUserLeaf) *MerkleTriple
}

var PublicChain = &ChainType{
	DbType:          DBSigChainTailPublic,
	Private:         false,
	Encrypted:       false,
	GetMerkleTriple: func(u *MerkleUserLeaf) *MerkleTriple { return u.public },
}

//========================================================================

type SigChainLoader struct {
	user           *User
	self           bool
	allKeys        bool
	leaf           *MerkleUserLeaf
	chain          *SigChain
	chainType      *ChainType
	links          []*ChainLink
	ckf            ComputedKeyFamily
	dirtyTail      *MerkleTriple
	loadedFromHead bool

	// The preloaded sigchain; maybe we're loading a user that already was
	// loaded, and here's the existing sigchain.
	preload *SigChain

	Contextified
}

//========================================================================

func (l *SigChainLoader) LoadLastLinkIDFromStorage() (mt *MerkleTriple, err error) {
	var tmp MerkleTriple
	var found bool
	found, err = G.LocalDb.GetInto(&tmp, l.dbKey())
	if err != nil {
		G.Log.Debug("| Error loading last link: %s", err)
	} else if !found {
		G.Log.Debug("| LastLinkId was null")
	} else {
		mt = &tmp
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
	var curr LinkID
	var links []*ChainLink
	var mt *MerkleTriple
	goodKey := true

	uid := l.user.GetUID()

	G.Log.Debug("+ SigChainLoader.LoadFromStorage(%s)", uid)
	defer func() { G.Log.Debug("- SigChainLoader.LoadFromStorage(%s) -> %s", uid, ErrToOk(err)) }()

	if mt, err = l.LoadLastLinkIDFromStorage(); err != nil || mt == nil {
		G.Log.Debug("| Failed to load last link ID")
		if err == nil {
			G.Log.Debug("| no error loading last link ID from storage")
		}
		if mt == nil {
			G.Log.Debug("| mt (MerkleTriple) nil result from load last link ID from storage")
		}
		return err
	}

	// Load whatever the last fingerprint was in the chain if we're not loading
	// allKeys. We have to load something...  Note that we don't use l.fp
	// here (as we used to) since if the user used to have chainlinks, and then
	// removed their key, we still want to load their last chainlinks.
	var loadKID keybase1.KID

	curr = mt.LinkID
	var link *ChainLink

	suid := l.selfUID()

	for curr != nil && goodKey {
		G.Log.Debug("| loading link; curr=%s", curr)
		if link, err = ImportLinkFromStorage(curr, suid); err != nil {
			return
		}
		kid2 := link.ToEldestKID()

		if loadKID.IsNil() {
			loadKID = kid2
			G.Log.Debug("| Setting loadKID=%s", kid2)
		} else if !l.allKeys && loadKID.Exists() && !loadKID.Equal(kid2) {
			goodKey = false
			G.Log.Debug("| Stop loading at KID=%s (!= KID=%s)", loadKID, kid2)
		}

		if goodKey {
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
		uid:          l.user.GetUID(),
		username:     l.user.GetNormalizedName(),
		chainLinks:   l.links,
		allKeys:      l.allKeys,
		Contextified: l.Contextified,
	}
	for _, link := range l.links {
		link.SetParent(sc)
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
	cli := sc.GetCurrentTailTriple()

	future := sc.GetFutureChainTail()
	Efn := NewServerChainError
	G.Log.Debug("+ CheckFreshness")
	defer G.Log.Debug("- CheckFreshness (%s) -> (%v,%s)", sc.uid, current, ErrToOk(err))
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
		return
	}

	if srv == nil {
		return
	}

	if b < 0 || a > b {
		err = Efn("Server version-rollback suspected: Local %d > %d", a, b)
		return
	}

	if b == a {
		G.Log.Debug("| Local chain version is up-to-date @ version %d", b)
		current = true
		if cli == nil {
			err = Efn("Failed to read last link for user")
			return
		}
		if !cli.LinkID.Eq(srv.LinkID) {
			err = Efn("The server returned the wrong sigchain tail")
			return
		}
	} else {
		G.Log.Debug("| Local chain version is out-of-date: %d < %d", a, b)
		current = false
	}

	if current && future != nil && (cli == nil || cli.Seqno < future.Seqno) {
		G.Log.Debug("| Still need to reload, since locally, we know seqno=%d is last", future.Seqno)
		current = false
	}

	return
}

//========================================================================

func (l *SigChainLoader) CheckFreshness() (current bool, err error) {
	return l.chain.CheckFreshness(l.GetMerkleTriple())
}

//========================================================================

func (l *SigChainLoader) selfUID() (uid keybase1.UID) {
	if !l.self {
		return
	}
	return l.user.GetUID()
}

//========================================================================

func (l *SigChainLoader) LoadFromServer() (err error) {
	srv := l.GetMerkleTriple()
	l.dirtyTail, l.loadedFromHead, err = l.chain.LoadFromServer(srv, l.selfUID())
	return
}

//========================================================================

func (l *SigChainLoader) VerifySigsAndComputeKeys() (err error) {
	G.Log.Debug("VerifySigsAndComputeKeys(): l.leaf: %v, l.leaf.eldest: %v, l.ckf: %v", l.leaf, l.leaf.eldest, l.ckf)
	if l.ckf.kf != nil {
		_, err = l.chain.VerifySigsAndComputeKeys(l.leaf.eldest, &l.ckf, l.needStartAtOneCheck())
	}
	return
}

func (l *SigChainLoader) dbKey() DbKey {
	return DbKeyUID(l.chainType.DbType, l.user.GetUID())
}

func (l *SigChainLoader) StoreTail() (err error) {
	if l.dirtyTail == nil {
		return
	}
	err = G.LocalDb.PutObj(l.dbKey(), nil, l.dirtyTail)
	G.Log.Debug("| Storing dirtyTail @ %d (%v)", l.dirtyTail.Seqno, l.dirtyTail)
	if err == nil {
		l.dirtyTail = nil
	}
	return
}

// Store a SigChain to local storage as a result of having loaded it.
// We eagerly write loaded chain links to storage if they verify properly.
func (l *SigChainLoader) Store() (err error) {
	err = l.StoreTail()
	if err == nil {
		err = l.chain.Store()
	}
	return
}

func (l *SigChainLoader) needStartAtOneCheck() bool {
	return l.loadedFromHead || l.allKeys
}

// Load is the main entry point into the SigChain loader.  It runs through
// all of the steps to load a chain in from storage, to refresh it against
// the server, and to verify its integrity.
func (l *SigChainLoader) Load() (ret *SigChain, err error) {
	var current bool
	var preload bool

	uid := l.user.GetUID()

	G.Log.Debug("+ SigChainLoader.Load(%s)", uid)
	defer func() {
		G.Log.Debug("- SigChainLoader.Load(%s) -> (%v, %s)", uid, (ret != nil), ErrToOk(err))
	}()

	stage := func(s string) {
		G.Log.Debug("| SigChainLoader.Load(%s) %s", uid, s)
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

	if l.needStartAtOneCheck() {
		if err = l.chain.CheckChainStartsAtOne(); err != nil {
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
