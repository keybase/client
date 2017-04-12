// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"io"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

//
// As of Sigchain V2, there are 3 types of sigchain links you might
// encounter.
//
//   V1 AKA Inner: The original sigchain link is a JSON blob describing
//    the signer's eldest key, signing key, payload, and prev pointers,
//    among other fields. As we migrate to sigchain V2, this is known as the
//    "inner" link. It persists in some cases and is elided for bandwidth
//    savings in others.
//
//   V2 AKA Outer/Inner Split: In V2, the signer computers a signature over
//    a much smaller outer link (see OuterLinkV2 in chain_link_v2.go). The
//    "curr" field in the outer link points to a V1 inner link by content hash.
//    Essential fields from the V1 inner link are hoisted up into the V2 outer
//    link and therefore must agree. Thus, the "prev" pointer in the V2 outer
//    link is the same as the "prev" pointer in the V2 inner link; it equals
//    the "curr" pointer of the previous outer link.
//
//   V2 Stubbed: To save bandwidth, the server is allowed to send over just
//    the V2 Outer link, minus any signatures, minus an inner link, if the
//    consuming client can safely ignore those details.
//

type SigChain struct {
	Contextified

	uid               keybase1.UID
	username          NormalizedUsername
	chainLinks        []*ChainLink
	idVerified        bool
	allKeys           bool
	loadedFromLinkOne bool
	wasFullyCached    bool

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

func (sc *SigChain) LocalDelegate(kf *KeyFamily, key GenericKey, sigID keybase1.SigID, signingKid keybase1.KID, isSibkey bool) (err error) {

	cki := sc.localCki
	l := sc.GetLastLink()
	if cki == nil && l != nil && l.cki != nil {
		// TODO: Figure out whether this needs to be a deep copy. See
		// https://github.com/keybase/client/issues/414 .
		cki = l.cki.ShallowCopy()
	}
	if cki == nil {
		sc.G().Log.Debug("LocalDelegate: creating new cki (signingKid: %s)", signingKid)
		cki = NewComputedKeyInfos(sc.G())
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
				sc.G().Log.Debug("GetComputedKeyInfos: l.cki is nil")
			}
			cki = l.cki
		}
	}
	return
}

func (sc SigChain) GetFutureChainTail() (ret *MerkleTriple) {
	now := sc.G().Clock().Now()
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
	sc.G().Log.Debug("| Bumping SigChain LastKnownSeqno to %d", mt.Seqno)
	sc.localChainTail = &mt
	sc.localChainUpdateTime = sc.G().Clock().Now()
}

func (sc *SigChain) LoadFromServer(ctx context.Context, t *MerkleTriple, selfUID keybase1.UID) (dirtyTail *MerkleTriple, err error) {
	low := sc.GetLastLoadedSeqno()
	sc.loadedFromLinkOne = (low == Seqno(0) || low == Seqno(-1))

	isSelf := selfUID.Equal(sc.uid)

	sc.G().Log.CDebugf(ctx, "+ Load SigChain from server (uid=%s, low=%d)", sc.uid, low)
	defer func() { sc.G().Log.CDebugf(ctx, "- Loaded SigChain -> %s", ErrToOk(err)) }()

	res, err := sc.G().API.Get(APIArg{
		Endpoint:    "sig/get",
		SessionType: APISessionTypeNONE,
		Args: HTTPArgs{
			"uid":           UIDArg(sc.uid),
			"low":           I{int(low)},
			"v2_compressed": B{true},   // TODO: Change the server to honor this flag
			"self":          B{isSelf}, // TODO: Change the server to honor this flag
		},
		NetContext: ctx,
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

	sc.G().Log.CDebugf(ctx, "| Got back %d new entries", lim)

	var links []*ChainLink
	var tail *ChainLink

	for i := 0; i < lim; i++ {
		var link *ChainLink
		if link, err = ImportLinkFromServer(sc.G(), sc, v.AtIndex(i), selfUID); err != nil {
			return
		}
		if link.GetSeqno() <= low {
			continue
		}
		if selfUID.Equal(link.GetUID()) {
			sc.G().Log.CDebugf(ctx, "| Setting isOwnNewLinkFromServer=true for seqno %d", link.GetSeqno())
			link.isOwnNewLinkFromServer = true
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
			sc.G().Log.CDebugf(ctx, "| Clear cached last (%d < %d)", sc.localChainTail.Seqno, dirtyTail.Seqno)
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

func (sc *SigChain) VerifyChain(ctx context.Context) (err error) {
	sc.G().Log.CDebugf(ctx, "+ SigChain#VerifyChain()")
	defer func() {
		sc.G().Log.CDebugf(ctx, "- SigChain#VerifyChain() -> %s", ErrToOk(err))
	}()
	for i := len(sc.chainLinks) - 1; i >= 0; i-- {
		curr := sc.chainLinks[i]
		sc.G().VDL.CLogf(ctx, VLog1, "| verify link %d (%s)", i, curr.id)
		if curr.chainVerified {
			sc.G().Log.CDebugf(ctx, "| short-circuit at link %d", i)
			break
		}
		if err = curr.VerifyLink(); err != nil {
			return err
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
			return err
		}
		curr.chainVerified = true
	}

	return err
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
	sc.G().Log.Debug("+ GetLastKnownSeqno()")
	defer func() {
		sc.G().Log.Debug("- GetLastKnownSeqno() -> %d", ret)
	}()
	if sc.localChainTail != nil {
		sc.G().Log.Debug("| Cached in last summary object...")
		ret = sc.localChainTail.Seqno
	} else {
		ret = sc.GetLastLoadedSeqno()
	}
	return
}

func (sc SigChain) GetLastLoadedSeqno() (ret Seqno) {
	sc.G().Log.Debug("+ GetLastLoadedSeqno()")
	defer func() {
		sc.G().Log.Debug("- GetLastLoadedSeqno() -> %d", ret)
	}()
	if l := last(sc.chainLinks); l != nil {
		sc.G().Log.Debug("| Fetched from main chain")
		ret = l.GetSeqno()
	}
	return
}

func (sc *SigChain) Store(ctx context.Context) (err error) {
	for i := len(sc.chainLinks) - 1; i >= 0; i-- {
		link := sc.chainLinks[i]
		var didStore bool
		if didStore, err = link.Store(sc.G()); err != nil || !didStore {
			return
		}
	}
	return nil
}

// Some users (6) managed to reuse eldest keys after a sigchain reset, without
// using the "eldest" link type, before the server prohibited this. To clients,
// that means their chains don't appear to reset. We hardcode these cases.
var hardcodedResets = map[keybase1.SigID]bool{
	"11111487aa193b9fafc92851176803af8ed005983cad1eaf5d6a49a459b8fffe0f": true,
	"df0005f6c61bd6efd2867b320013800781f7f047e83fd44d484c2cb2616f019f0f": true,
	"32eab86aa31796db3200f42f2553d330b8a68931544bbb98452a80ad2b0003d30f": true,
	"5ed7a3356fd0f759a4498fc6fed1dca7f62611eb14f782a2a9cda1b836c58db50f": true,
	"d5fe2c5e31958fe45a7f42b325375d5bd8916ef757f736a6faaa66a6b18bec780f": true,
	"1e116e81bc08b915d9df93dc35c202a75ead36c479327cdf49a15f3768ac58f80f": true,
}

// GetCurrentSubchain takes the given sigchain and walks backward until it
// finds the start of the current subchain, returning all the links in the
// subchain. A new subchain starts in one of three ways (from the perspective
// of walking from oldest to newest):
// 1) A link has a new eldest key, usually in the form of reporting no
//    eldest_kid of its own and being signed by a KID that's not the previous
//    eldest. Most resets so far take this form.
// 2) A link of type "eldest", regardless of the KIDs involved. We want this to
//    be how everything works in the future.
// 3) One of a set of six hardcoded links that made it in back when we allowed
//    repeating eldest keys without using the "eldest" link type.
func (sc *SigChain) GetCurrentSubchain(eldest keybase1.KID) (links []*ChainLink, err error) {
	if sc.chainLinks == nil {
		return
	}
	l := len(sc.chainLinks)
	lastGood := l
	for i := l - 1; i >= 0; i-- {

		if sc.chainLinks[i].IsStubbed() {
			lastGood = i
			if sc.chainLinks[i].IsEldest() {
				break
			}
			continue
		}

		// Check that the eldest KID hasn't changed.
		if sc.chainLinks[i].ToEldestKID().Equal(eldest) {
			lastGood = i
		} else {
			break
		}
		// Also stop walking if the current link has type "eldest".
		if sc.chainLinks[i].IsEldest() {
			break
		}
		// Or if the link is one of our hardcoded six that reuse an eldest key ambiguously.
		if hardcodedResets[sc.chainLinks[i].unpacked.sigID] {
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
func (sc *SigChain) verifySubchain(ctx context.Context, kf KeyFamily, links []*ChainLink) (cached bool, cki *ComputedKeyInfos, err error) {
	un := sc.username

	sc.G().Log.CDebugf(ctx, "+ verifySubchain")
	defer func() {
		sc.G().Log.CDebugf(ctx, "- verifySubchain -> %v, %s", cached, ErrToOk(err))
	}()

	if len(links) == 0 {
		err = InternalError{"verifySubchain should never get an empty chain."}
		return cached, cki, err
	}

	last := links[len(links)-1]
	if cki = last.GetSigCheckCache(); cki != nil {
		cached = true
		sc.G().Log.CDebugf(ctx, "Skipped verification (cached): %s", last.id)
		return cached, cki, err
	}

	cki = NewComputedKeyInfos(sc.G())
	ckf := ComputedKeyFamily{kf: &kf, cki: cki, Contextified: sc.Contextified}

	first := true

	for linkIndex, link := range links {
		if isBad, reason := link.IsBad(); isBad {
			sc.G().Log.CDebugf(ctx, "Ignoring bad chain link with sig ID %s: %s", link.GetSigID(), reason)
			continue
		}

		if link.IsStubbed() {
			if first {
				return cached, cki, SigchainV2StubbedFirstLinkError{}
			}
			if link.NeedsSignature() {
				return cached, cki, SigchainV2StubbedSignatureNeededError{}
			}
			sc.G().VDL.Log(VLog1, "| Skipping over stubbed-out link: %s", link.id)
			continue
		}

		tcl, w := NewTypedChainLink(link)
		if w != nil {
			w.Warn(sc.G())
		}

		sc.G().VDL.Log(VLog1, "| Verify link: %s", link.id)

		if first {
			if err = ckf.InsertEldestLink(tcl, un); err != nil {
				return cached, cki, err
			}
			first = false
		}

		// Optimization: only check sigs on some links, like the final
		// link, or those that delegate and revoke keys.
		// Note that we do this *before* processing revocations in the key
		// family. That's important because a chain link might revoke the same
		// key that signed it.
		isDelegating := (tcl.GetRole() != DLGNone)
		isModifyingKeys := isDelegating || tcl.Type() == DelegationTypePGPUpdate
		isFinalLink := (linkIndex == len(links)-1)
		hasRevocations := link.HasRevocations()

		if pgpcl, ok := tcl.(*PGPUpdateChainLink); ok {
			if hash := pgpcl.GetPGPFullHash(); hash != "" {
				sc.G().Log.CDebugf(ctx, "| Setting active PGP hash for %s: %s", pgpcl.kid, hash)
				ckf.SetActivePGPHash(pgpcl.kid, hash)
			}
		}

		if isModifyingKeys || isFinalLink || hasRevocations {
			err = link.VerifySigWithKeyFamily(ckf)
			if err != nil {
				sc.G().Log.CDebugf(ctx, "| Failure in VerifySigWithKeyFamily: %s", err)
				return cached, cki, err
			}
		}

		if isDelegating {
			err = ckf.Delegate(tcl)
			if err != nil {
				sc.G().Log.CDebugf(ctx, "| Failure in Delegate: %s", err)
				return cached, cki, err
			}
		}

		if err = tcl.VerifyReverseSig(ckf); err != nil {
			sc.G().Log.CDebugf(ctx, "| Failure in VerifyReverseSig: %s", err)
			return cached, cki, err
		}

		if err = ckf.Revoke(tcl); err != nil {
			return cached, cki, err
		}

		if err = ckf.UpdateDevices(tcl); err != nil {
			return cached, cki, err
		}

		if err != nil {
			sc.G().Log.CDebugf(ctx, "| bailing out on error: %s", err)
			return cached, cki, err
		}
	}

	last.PutSigCheckCache(cki)
	return cached, cki, err
}

func (sc *SigChain) VerifySigsAndComputeKeys(ctx context.Context, eldest keybase1.KID, ckf *ComputedKeyFamily) (cached bool, err error) {

	cached = false
	sc.G().Log.CDebugf(ctx, "+ VerifySigsAndComputeKeys for user %s (eldest = %s)", sc.uid, eldest)
	defer func() {
		sc.G().Log.CDebugf(ctx, "- VerifySigsAndComputeKeys for user %s -> %s", sc.uid, ErrToOk(err))
	}()

	if err = sc.VerifyChain(ctx); err != nil {
		return
	}

	if sc.allKeys || sc.loadedFromLinkOne {
		if first := sc.getFirstSeqno(); first > Seqno(1) {
			err = ChainLinkWrongSeqnoError{fmt.Sprintf("Wanted a chain from seqno=1, but got seqno=%d", first)}
			return
		}
	}

	if ckf.kf == nil || eldest.IsNil() {
		sc.G().Log.CDebugf(ctx, "| VerifyWithKey short-circuit, since no Key available")
		sc.localCki = NewComputedKeyInfos(sc.G())
		ckf.cki = sc.localCki
		return
	}
	links, err := sc.GetCurrentSubchain(eldest)
	if err != nil {
		return
	}

	if len(links) == 0 {
		sc.G().Log.CDebugf(ctx, "| Empty chain after we limited to eldest %s", eldest)
		eldestKey, _ := ckf.FindKeyWithKIDUnsafe(eldest)
		sc.localCki = NewComputedKeyInfos(sc.G())
		err = sc.localCki.InsertServerEldestKey(eldestKey, sc.username)
		ckf.cki = sc.localCki
		return
	}

	if cached, ckf.cki, err = sc.verifySubchain(ctx, *ckf.kf, links); err != nil {
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

// GetLinkFromSigIDQuery will return true if it finds a ChainLink
// with a SigID that starts with query.
func (sc *SigChain) GetLinkFromSigIDQuery(query string) *ChainLink {
	for _, link := range sc.chainLinks {
		if link.GetSigID().Match(query, false) {
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
	user      *User
	self      bool
	allKeys   bool
	leaf      *MerkleUserLeaf
	chain     *SigChain
	chainType *ChainType
	links     []*ChainLink
	ckf       ComputedKeyFamily
	dirtyTail *MerkleTriple

	// The preloaded sigchain; maybe we're loading a user that already was
	// loaded, and here's the existing sigchain.
	preload *SigChain

	ctx context.Context

	Contextified
}

//========================================================================

func (l *SigChainLoader) LoadLastLinkIDFromStorage() (mt *MerkleTriple, err error) {
	var tmp MerkleTriple
	var found bool
	found, err = l.G().LocalDb.GetInto(&tmp, l.dbKey())
	if err != nil {
		l.G().Log.Debug("| Error loading last link: %s", err)
	} else if !found {
		l.G().Log.Debug("| LastLinkId was null")
	} else {
		mt = &tmp
	}
	return
}

func (l *SigChainLoader) AccessPreload() bool {
	if l.preload == nil || (l.preload.allKeys != l.allKeys) {
		l.G().Log.Debug("| Preload failed")
		return false
	}
	l.G().Log.Debug("| Preload successful")
	src := l.preload.chainLinks
	l.links = make([]*ChainLink, len(src))
	copy(l.links, src)
	return true
}

func (l *SigChainLoader) LoadLinksFromStorage() (err error) {
	var curr LinkID
	var links []*ChainLink
	var mt *MerkleTriple
	goodKey := true

	uid := l.user.GetUID()

	l.G().Log.CDebugf(l.ctx, "+ SigChainLoader.LoadFromStorage(%s)", uid)
	defer func() { l.G().Log.CDebugf(l.ctx, "- SigChainLoader.LoadFromStorage(%s) -> %s", uid, ErrToOk(err)) }()

	if mt, err = l.LoadLastLinkIDFromStorage(); err != nil || mt == nil {
		l.G().Log.CDebugf(l.ctx, "| Failed to load last link ID")
		if err == nil {
			l.G().Log.CDebugf(l.ctx, "| no error loading last link ID from storage")
		}
		if mt == nil {
			l.G().Log.CDebugf(l.ctx, "| mt (MerkleTriple) nil result from load last link ID from storage")
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
		l.G().VDL.Log(VLog1, "| loading link; curr=%s", curr)
		if link, err = ImportLinkFromStorage(curr, suid, l.G()); err != nil {
			return
		}
		if link == nil {
			l.G().Log.CDebugf(l.ctx, "| ImportLinkFromStorage returned nil")
			return
		}
		kid2 := link.ToEldestKID()

		if loadKID.IsNil() {
			loadKID = kid2
			l.G().Log.CDebugf(l.ctx, "| Setting loadKID=%s", kid2)
		} else if !l.allKeys && loadKID.Exists() && !loadKID.Equal(kid2) {
			goodKey = false
			l.G().Log.CDebugf(l.ctx, "| Stop loading at KID=%s (!= KID=%s)", loadKID, kid2)
		}

		if goodKey {
			links = append(links, link)
			curr = link.GetPrev()
		}
	}

	reverse(links)
	l.G().Log.CDebugf(l.ctx, "| Loaded %d links", len(links))

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
	sc.G().Log.Debug("+ CheckFreshness")
	defer sc.G().Log.Debug("- CheckFreshness (%s) -> (%v,%s)", sc.uid, current, ErrToOk(err))
	a := Seqno(-1)
	b := Seqno(-1)

	if srv != nil {
		sc.G().Log.Debug("| Server triple: %v", srv)
		b = srv.Seqno
	} else {
		sc.G().Log.Debug("| Server triple=nil")
	}
	if cli != nil {
		sc.G().Log.Debug("| Client triple: %v", cli)
		a = cli.Seqno
	} else {
		sc.G().Log.Debug("| Client triple=nil")
	}
	if future != nil {
		sc.G().Log.Debug("| Future triple: %v", future)
	} else {
		sc.G().Log.Debug("| Future triple=nil")
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
		sc.G().Log.Debug("| Local chain version is up-to-date @ version %d", b)
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
		sc.G().Log.Debug("| Local chain version is out-of-date: %d < %d", a, b)
		current = false
	}

	if current && future != nil && (cli == nil || cli.Seqno < future.Seqno) {
		sc.G().Log.Debug("| Still need to reload, since locally, we know seqno=%d is last", future.Seqno)
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
	l.dirtyTail, err = l.chain.LoadFromServer(l.ctx, srv, l.selfUID())
	return
}

//========================================================================

func (l *SigChainLoader) VerifySigsAndComputeKeys() (err error) {
	l.G().Log.CDebugf(l.ctx, "VerifySigsAndComputeKeys(): l.leaf: %v, l.leaf.eldest: %v, l.ckf: %v", l.leaf, l.leaf.eldest, l.ckf)
	if l.ckf.kf != nil {
		_, err = l.chain.VerifySigsAndComputeKeys(l.ctx, l.leaf.eldest, &l.ckf)
	}
	return
}

func (l *SigChainLoader) dbKey() DbKey {
	return DbKeyUID(l.chainType.DbType, l.user.GetUID())
}

func (l *SigChainLoader) StoreTail() (err error) {
	if l.dirtyTail == nil {
		return nil
	}
	err = l.G().LocalDb.PutObj(l.dbKey(), nil, l.dirtyTail)
	l.G().Log.CDebugf(l.ctx, "| Storing dirtyTail @ %d (%v)", l.dirtyTail.Seqno, l.dirtyTail)
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
		err = l.chain.Store(l.ctx)
	}
	return
}

func (l *SigChainLoader) merkleTreeEldestMatchesLastLinkEldest() bool {
	lastLink := l.chain.GetLastLink()
	if lastLink == nil {
		return false
	}
	return lastLink.ToEldestKID().Equal(l.leaf.eldest)
}

// Load is the main entry point into the SigChain loader.  It runs through
// all of the steps to load a chain in from storage, to refresh it against
// the server, and to verify its integrity.
func (l *SigChainLoader) Load() (ret *SigChain, err error) {
	defer TimeLog(fmt.Sprintf("SigChainLoader#Load: %s", l.user.GetName()), l.G().Clock().Now(), l.G().Log.Debug)
	var current bool
	var preload bool

	uid := l.user.GetUID()

	l.G().Log.CDebugf(l.ctx, "+ SigChainLoader#Load(%s)", uid)
	defer func() {
		l.G().Log.CDebugf(l.ctx, "- SigChainLoader#Load(%s) -> (%v, %s)", uid, (ret != nil), ErrToOk(err))
	}()

	stage := func(s string) {
		l.G().Log.CDebugf(l.ctx, "| SigChainLoader#Load(%s) %s", uid, s)
	}

	stage("GetFingerprint")
	if err = l.GetKeyFamily(); err != nil {
		return
	}

	stage("AccessPreload")
	preload = l.AccessPreload()

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
	if err = l.chain.VerifyChain(l.ctx); err != nil {
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
	} else if l.chain.GetComputedKeyInfos() == nil {
		// The chain tip doesn't have a cached cki, probably because new
		// signatures have shown up since the last time we loaded it.
		l.G().Log.CDebugf(l.ctx, "| Need to reverify chain since we don't have ComputedKeyInfos")
	} else if !l.merkleTreeEldestMatchesLastLinkEldest() {
		// CheckFreshness above might've decided our chain tip hasn't moved,
		// but we might still need to proceed with the rest of the load if the
		// eldest KID has changed.
		l.G().Log.CDebugf(l.ctx, "| Merkle leaf doesn't match the chain tip.")
	} else {
		// The chain tip has a cached cki, AND the current eldest kid matches
		// it. Use what's cached and short circuit.
		l.G().Log.CDebugf(l.ctx, "| Sigchain was fully cached. Short-circuiting verification.")
		ret.wasFullyCached = true
		return
	}

	stage("VerifyChain")
	if err = l.chain.VerifyChain(l.ctx); err != nil {
		return
	}
	stage("Store")
	if err = l.chain.Store(l.ctx); err != nil {
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
