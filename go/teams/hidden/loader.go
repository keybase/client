package hidden

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/sig3"
)

// LoaderPackage contains a snapshot of the hidden team chain, used during the process of loading a team.
// It additionally can have new chain links loaded from the server, since it might need to be queried
// in the process of loading the team as if the new links were already committed to the data store.
type LoaderPackage struct {
	id                 keybase1.TeamID
	encKID             keybase1.KID
	encKIDGen          keybase1.PerTeamKeyGeneration
	data               *keybase1.HiddenTeamChain
	newData            *keybase1.HiddenTeamChain
	expectedPrev       *keybase1.LinkTriple
	rbks               *RatchetBlindingKeySet
	allNewRatchets     map[keybase1.Seqno]keybase1.LinkTripleAndTime
	newRatchetSet      keybase1.HiddenTeamChainRatchetSet
	role               keybase1.TeamRole
	lastCommittedSeqno keybase1.Seqno
}

// NewLoaderPackage creates a loader package that can work in the FTL of slow team loading settings. As a preliminary,
// it loads any stored hidden team data for the team from local storage. The getter function is used to get a recent PTK
// for this team, which is needed to poll the Merkle Tree endpoint when asking "does a hidden team chain exist for this team?"
func NewLoaderPackage(mctx libkb.MetaContext, id keybase1.TeamID,
	getter func() (keybase1.KID, keybase1.PerTeamKeyGeneration, keybase1.TeamRole, error)) (ret *LoaderPackage, err error) {
	encKID, gen, role, err := getter()
	if err != nil {
		return nil, err
	}
	ret = newLoaderPackage(id, encKID, gen, role)
	err = ret.Load(mctx)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

// NewLoaderPackageForPrecheck makes a loader package just for the purposes of prechecking a link we're about to send
// up to the server. It doesn't bother to load the team from storage.
func NewLoaderPackageForPrecheck(mctx libkb.MetaContext, id keybase1.TeamID, data *keybase1.HiddenTeamChain) *LoaderPackage {
	return &LoaderPackage{
		id:   id,
		data: data,
	}
}

// newLoaderPackage creates an object used to load the hidden team chain along with the
// slow or fast team loader. It manages internal state during the loading process. Pass an
// encryption KID from the main chain for authentication purposes, that we can prove to the server
// that we've previously seen data for this team (and therefor we're allowed to know whether or not
// the team has a hidden chain (but nothing more)).
func newLoaderPackage(id keybase1.TeamID, e keybase1.KID, g keybase1.PerTeamKeyGeneration, role keybase1.TeamRole) *LoaderPackage {
	return &LoaderPackage{id: id, encKID: e, encKIDGen: g, role: role}
}

// Load in data from storage for this chain. We're going to make a deep copy so that
// we don't worry about mutating the object in the storage layer's memory LRU.
func (l *LoaderPackage) Load(mctx libkb.MetaContext) (err error) {
	tmp, err := mctx.G().GetHiddenTeamChainManager().Load(mctx, l.id)
	if err != nil {
		return err
	}
	if tmp == nil {
		return nil
	}
	cp := tmp.DeepCopy()
	l.data = &cp
	return err
}

func (l *LoaderPackage) lastReaderPerTeamKeyLinkID() (ret keybase1.LinkID) {
	if l.data == nil {
		return ret
	}
	return l.data.LastReaderPerTeamKeyLinkID()
}

// IsStale returns true if we got a gregor hint from the server that there is a new link and we haven't
// pulled it down yet from the server.
func (l *LoaderPackage) IsStale() bool {
	if l.data == nil {
		return false
	}
	return l.data.IsStale()
}

// checkPrev checks the earliest chainlink in the update against previously fetched chainlinks.
// It requires the prev to be there and to not clash.
func (l *LoaderPackage) checkPrev(mctx libkb.MetaContext, first sig3.Generic) (err error) {
	q := first.Seqno()
	prev := first.Prev()
	if (q == keybase1.Seqno(1)) != (prev == nil) {
		return NewLoaderError("bad link; seqno=%d, prev=%v (want 1 and nil or >1 and non-nil)", q, prev)
	}
	if q == keybase1.Seqno(1) {
		return nil
	}
	if l.data == nil {
		return NewLoaderError("didn't get prior data and update was for a chain middle")
	}
	link, ok := l.data.Outer[q-1]
	if !ok {
		return NewLoaderError("previous link wasn't found")
	}
	if !link.Eq(prev.Export()) {
		return NewLoaderError("prev mismatch at %d", q)
	}

	// We check prevs again when we commit this change to the hidden team chain manager. It's not
	// strictly required, but it seems a good safeguard against future programming bugs. So
	// store it away here.
	l.expectedPrev = &keybase1.LinkTriple{
		Seqno:   q - 1,
		LinkID:  link,
		SeqType: keybase1.SeqType_TEAM_PRIVATE_HIDDEN,
	}

	return nil
}

// checkExpectedHighSeqno enforces that the links we got down from the server (links) are at or surpass
// the sequence number ther server promised through the ratchet sets. We look at both the loaded and the
// received downloaded ratchets for this check.
func (l *LoaderPackage) checkExpectedHighSeqno(mctx libkb.MetaContext, links []sig3.Generic) (err error) {
	last := l.LastSeqno()
	max := l.MaxRatchet()
	if max <= last {
		return nil
	}
	if len(links) > 0 && links[len(links)-1].Seqno() >= max {
		return nil
	}
	return NewLoaderError("Server promised a hidden chain up to %d, but never received; is it withholding?", max)
}

// checkLoadedRatchet checks the given loaded ratchet against the consumed update and verifies a (seqno, linkID) match
// for that ratchet.
func (l *LoaderPackage) checkLoadedRatchet(mctx libkb.MetaContext, update *keybase1.HiddenTeamChain, ratchet keybase1.LinkTripleAndTime) (err error) {
	q := ratchet.Triple.Seqno
	link, ok := update.Outer[q]
	if ok && !link.Eq(ratchet.Triple.LinkID) {
		return NewLoaderError("update data failed to match ratchet %+v v %s", ratchet, link)
	}
	return nil
}

// checkLoadedRatchetSet checks the hidden chain update against the ratchet set that we loaded from storage before
// we brought the updated down from the server. It will not check against ratchets that came down with the update
// (in the visible chain). This works by checking the update for validity against each type of ratchet
// (and there are 3: self, main, and blinded tree).
func (l *LoaderPackage) checkLoadedRatchetSet(mctx libkb.MetaContext, update *keybase1.HiddenTeamChain) (err error) {
	if l.data == nil {
		return nil
	}
	for _, r := range l.data.RatchetSet.Flat() {
		err = l.checkLoadedRatchet(mctx, update, r)
		if err != nil {
			return err
		}
	}
	return nil
}

// CheckPTKsForDuplicates checks that the new per-team-keys don't duplicate keys we've gotten along the
// visible chain, via the given getter.
func (l *LoaderPackage) CheckPTKsForDuplicates(mctx libkb.MetaContext, getter func(g keybase1.PerTeamKeyGeneration) bool) error {
	if l.newData == nil {
		return nil
	}
	for k := range l.newData.ReaderPerTeamKeys {
		if getter(k) {
			return newRepeatPTKGenerationError(k, "clashes a previously-loaded visible rotation")
		}
	}
	return nil
}

func (l *LoaderPackage) CheckNoPTK(mctx libkb.MetaContext, g keybase1.PerTeamKeyGeneration) (err error) {
	var found bool
	if l.newData != nil {
		_, found = l.newData.ReaderPerTeamKeys[g]
	}
	if l.data != nil && !found {
		_, found = l.data.ReaderPerTeamKeys[g]
	}
	if found {
		return newRepeatPTKGenerationError(g, "clashes a previously-loaded hidden rotation")
	}
	return nil
}

func (l *LoaderPackage) UpdateTeamMetadata(encKID keybase1.KID, encKIDGen keybase1.PerTeamKeyGeneration, role keybase1.TeamRole) {
	l.encKID = encKID
	l.encKIDGen = encKIDGen
	l.role = role
}

// Update combines the preloaded data with any downloaded updates from the server, and stores
// the result local to this object.
func (l *LoaderPackage) Update(mctx libkb.MetaContext, update []sig3.ExportJSON) (err error) {
	defer mctx.Trace(fmt.Sprintf("LoaderPackage#Update(%s, %d)", l.id, len(update)), func() error { return err })()
	mctx.Debug("LoaderPackage#Update pre: %s", l.data.LinkAndKeySummary())

	var data *keybase1.HiddenTeamChain
	data, err = l.updatePrecheck(mctx, update)
	if err != nil {
		return err
	}
	err = l.mergeData(mctx, data)
	if err != nil {
		return err
	}

	if l.newData != nil && l.lastCommittedSeqno > l.newData.LastCommittedSeqno {
		l.newData.LastCommittedSeqno = l.lastCommittedSeqno
	}

	// If we received a new uncommitted link.
	if l.newData != nil && l.newData.Last > 0 {
		if l.newData.LinkReceiptTimes == nil {
			l.newData.LinkReceiptTimes = make(map[keybase1.Seqno]keybase1.Time)
		}
		if _, found := l.newData.LinkReceiptTimes[l.data.Last]; !found && l.newData.Last > l.LastCommittedSeqno() {
			mctx.Debug("Adding seqno %v to LinkReceiptTimes", l.newData.Last)
			l.newData.LinkReceiptTimes[l.newData.Last] = keybase1.ToTime(mctx.G().Clock().Now())
		}
	}

	mctx.Debug("LoaderPackage#Update post: %s", l.data.LinkAndKeySummary())
	return nil
}

// checkNewLinksAgainstNewRatchtets checks a link sent down with the hidden update against the ratchets sent down
// with the visible team update. It makes sure they match up.
func (l *LoaderPackage) checkNewLinkAgainstNewRatchets(mctx libkb.MetaContext, q keybase1.Seqno, h keybase1.LinkID) (err error) {
	if l.allNewRatchets == nil {
		return nil
	}
	found, ok := l.allNewRatchets[q]
	if !ok {
		return nil
	}
	if !found.Triple.LinkID.Eq(h) {
		return NewLoaderError("link ID at %d fails to check against ratchet: %s != %s", q, found.Triple.LinkID, h)
	}
	return nil
}

// checkNewLinksAgainstNewRatchets checks all links in the update sent down from the server against all racthets
// sent down in the same update.
func (l *LoaderPackage) checkNewLinksAgainstNewRatchets(mctx libkb.MetaContext, update *keybase1.HiddenTeamChain) error {
	for k, v := range update.Outer {
		err := l.checkNewLinkAgainstNewRatchets(mctx, k, v)
		if err != nil {
			return err
		}
	}
	return nil
}

// This function checks that uncommitted links which we previously got from the
// server have indeed been included in the blind tree (the server has a short
// grace period to do this to account for potential downtime)
func (l *LoaderPackage) VerifyOldChainLinksAreCommitted(mctx libkb.MetaContext, newCommittedSeqno keybase1.Seqno) error {
	mctx.Debug("VerifyOldChainLinksAreCommitted at time %v", mctx.G().Clock().Now())
	if l.data == nil || l.data.LinkReceiptTimes == nil {
		return nil
	}
	for s, t := range l.data.LinkReceiptTimes {
		if s <= newCommittedSeqno {
			continue
		}
		if mctx.G().Clock().Since(t.Time()) > 48*time.Hour {
			return fmt.Errorf("Link for seqno %v was added %v ago and has not been included in the blind tree yet.", s, mctx.G().Clock().Since(t.Time()))
		}
	}
	return nil
}

// updatePrecheck runs a series of cryptographic validations on the update sent down from the server, to ensure that
// it can be accepted and used during the team loading process. It also converts the raw export Sig3 links into a
// HiddenTeamChain, which can be eventually merged with the existing hidden chain state for this team.
func (l *LoaderPackage) updatePrecheck(mctx libkb.MetaContext, update []sig3.ExportJSON) (ret *keybase1.HiddenTeamChain, err error) {
	var links []sig3.Generic
	links, err = importChain(mctx, update)
	if err != nil {
		return nil, err
	}

	err = sig3.CheckLinkSequence(links)
	if err != nil {
		return nil, err
	}

	err = l.checkExpectedHighSeqno(mctx, links)
	if err != nil {
		return nil, err
	}

	if len(links) == 0 {
		mctx.Debug("short-circuiting since no update")
		return nil, nil
	}

	err = l.checkPrev(mctx, links[0])
	if err != nil {
		return nil, err
	}

	data, err := l.toHiddenTeamChain(mctx, links)
	if err != nil {
		return nil, err
	}

	err = l.checkLoadedRatchetSet(mctx, data)
	if err != nil {
		return nil, err
	}

	err = l.checkNewLinksAgainstNewRatchets(mctx, data)
	if err != nil {
		return nil, err
	}

	return data, nil
}

// lastRotator returns the last user/KID combination to have signed a rotation into this hidden team chain.
// Or nil if the chain is empty.
func (l *LoaderPackage) lastRotator(mctx libkb.MetaContext, typ keybase1.PTKType) *keybase1.Signer {
	if l.data == nil {
		return nil
	}
	last, ok := l.data.LastPerTeamKeys[typ]
	if !ok {
		return nil
	}
	inner, ok := l.data.Inner[last]
	if !ok {
		return nil
	}
	return &inner.Signer
}

// LastReaderKeyRotator returns a signer object that signifies the last KID/UID pair to sign
// a reader PTK into this chain.
func (l *LoaderPackage) LastReaderKeyRotator(mctx libkb.MetaContext) *keybase1.Signer {
	return l.lastRotator(mctx, keybase1.PTKType_READER)
}

// mergeData takes the data from the update and merges it with the last load of this hidden team chain
// from local storage. The result is just in memory, not stored to disk yet. That happens in Commit().
func (l *LoaderPackage) mergeData(mctx libkb.MetaContext, newData *keybase1.HiddenTeamChain) (err error) {

	if newData == nil && (!l.newRatchetSet.IsEmpty() || l.lastCommittedSeqno > 0) {
		newData = keybase1.NewHiddenTeamChain(l.id)
	}
	if !l.newRatchetSet.IsEmpty() {
		newData.RatchetSet.Merge(l.newRatchetSet)
	}

	if l.lastCommittedSeqno > 0 && newData.LastCommittedSeqno < l.lastCommittedSeqno {
		newData.LastCommittedSeqno = l.lastCommittedSeqno
	}

	l.newData = newData

	if l.data == nil {
		l.data = newData
		return nil
	}
	if newData != nil {
		_, err = l.data.Merge(*newData)
		if err != nil {
			return err
		}
	}
	return nil
}

func (l *LoaderPackage) toHiddenTeamChain(mctx libkb.MetaContext, links []sig3.Generic) (ret *keybase1.HiddenTeamChain, err error) {
	ret = keybase1.NewHiddenTeamChain(l.id)
	ret.Public = l.id.IsPublic()
	for _, link := range links {
		err = populateLink(mctx, ret, link)
		if err != nil {
			return nil, err
		}
	}
	return ret, nil
}

func checkUpdateAgainstSeed(mctx libkb.MetaContext, getSeed func(keybase1.PerTeamKeyGeneration) *keybase1.PerTeamSeedCheck, update keybase1.HiddenTeamChainLink) (err error) {
	readerKey, ok := update.Ptk[keybase1.PTKType_READER]
	if !ok {
		// No reader key found in link, so no need to check it.
		return nil
	}
	gen := readerKey.Ptk.Gen
	check := getSeed(gen)
	if check == nil {
		return NewLoaderError("seed check at generation %d wasn't found", gen)
	}
	hash, err := check.Hash()
	if err != nil {
		return err
	}
	if readerKey.Check.Version != keybase1.PerTeamSeedCheckVersion_V1 {
		return NewLoaderError("can only handle seed check version 1; got %d", readerKey.Check.Version)
	}
	if check.Version != keybase1.PerTeamSeedCheckVersion_V1 {
		return NewLoaderError("can only handle seed check version 1; got computed check %s", check.Version)
	}
	if !hash.Eq(readerKey.Check) {
		return NewLoaderError("wrong seed check at generation %d", gen)
	}
	return nil
}

func (l *LoaderPackage) CheckUpdatesAgainstSeedsWithMap(mctx libkb.MetaContext, seeds map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeedItem) (err error) {
	return l.CheckUpdatesAgainstSeeds(mctx, func(g keybase1.PerTeamKeyGeneration) *keybase1.PerTeamSeedCheck {
		item, ok := seeds[g]
		if !ok {
			return nil
		}
		return item.Check
	})
}

// CheckUpdatesAgainstSeeds checks the update inside this loader package against unverified team seeds. It
// enforces equality and will error out if not. Through this check, a client can convince itself that the
// recent keyers knew the old keys.
func (l *LoaderPackage) CheckUpdatesAgainstSeeds(mctx libkb.MetaContext, f func(keybase1.PerTeamKeyGeneration) *keybase1.PerTeamSeedCheck) (err error) {
	defer mctx.Trace("LoaderPackage#CheckUpdatesAgainstSeeds", func() error { return err })()
	// RESTRICTEDBOTs are excluded since they do not have any seed access
	if l.newData == nil || l.role.IsRestrictedBot() {
		return nil
	}
	for _, update := range l.newData.Inner {
		err = checkUpdateAgainstSeed(mctx, f, update)
		if err != nil {
			return err
		}
	}
	return nil
}

// LastSeqno returns the last seqno when the preloaded sequence and the update are taken together.
func (l *LoaderPackage) LastSeqno() keybase1.Seqno {
	if l.data == nil {
		return keybase1.Seqno(0)
	}
	return l.data.Last
}

// LastFullSeqno returns the last seqno before the end of the chain, or before an unstubbed
// hole is found (as a result of FTL).
func (l *LoaderPackage) LastFullSeqno() keybase1.Seqno {
	if l.data == nil {
		return keybase1.Seqno(0)
	}
	return l.data.LastFullPopulateIfUnset()
}

// MaxRatchet returns the greatest sequence number across all ratchets in the loaded data and also
// in the data from the recent update from the server.
func (l *LoaderPackage) MaxRatchet() (ret keybase1.Seqno) {
	if l.data != nil {
		ret = l.data.RatchetSet.Max()
	}
	tmp := l.newRatchetSet.Max()
	if tmp > ret {
		ret = tmp
	}
	return ret
}

// LastCommittedSeqno returns the greatest sequence number which we have seen
// committed by the server, to prevent rollbacks to the blind tree sigchain. It
// does not include the seqno in the update which was recently received from the
// server. It returns 0 if we have never seen a non empty link committed to the
// blind tree before.
func (l *LoaderPackage) LastCommittedSeqno() (ret keybase1.Seqno) {
	if l.newData != nil && l.newData.LastCommittedSeqno > ret {
		ret = l.newData.LastCommittedSeqno
	}
	if l.lastCommittedSeqno > ret {
		ret = l.lastCommittedSeqno
	}
	if l.data != nil && l.data.LastCommittedSeqno > ret {
		ret = l.data.LastCommittedSeqno
	}
	return ret
}

func (l *LoaderPackage) SetLastCommittedSeqno(mctx libkb.MetaContext, lcs keybase1.Seqno) error {
	last := l.LastCommittedSeqno()
	if lcs >= last {
		l.lastCommittedSeqno = lcs
		return nil
	}
	return fmt.Errorf("Tries to set a LastCommittedSeqno %v smaller than the one we know about: %v", lcs, last)
}

func (l *LoaderPackage) CheckChainHasMinLength(mctx libkb.MetaContext, minSeqno keybase1.Seqno) error {
	if minSeqno == keybase1.Seqno(0) {
		return nil
	}
	if l.data == nil {
		return fmt.Errorf("Data is nil and so the chain deos not have seqno %v", minSeqno)
	}

	if !l.data.HasSeqno(minSeqno) {
		return fmt.Errorf("Seqno %v is not part of this chain (last is %v)", minSeqno, l.data.Last)
	}
	return nil
}

func (l *LoaderPackage) CheckHiddenMerklePathResponseAndAddRatchets(mctx libkb.MetaContext, hiddenResp *libkb.MerkleHiddenResponse) (hiddenIsFresh bool, err error) {

	oldHiddenTailSeqno := l.LastSeqno()
	oldCommittedHiddenTailSeqno := l.LastCommittedSeqno()
	lastCommittedHiddenTailSeqno := oldCommittedHiddenTailSeqno

	switch hiddenResp.RespType {
	case libkb.MerkleHiddenResponseTypeNONE:
		return false, fmt.Errorf("Logic error in CheckHiddenMerklePathResponseAndAddRatchets: should not call this function with a NONE response.")
	case libkb.MerkleHiddenResponseTypeFLAGOFF:
		mctx.Debug("Skipping CheckHiddenMerklePathResponseAndAddRatchets as feature flag is off")
	case libkb.MerkleHiddenResponseTypeOK:
		newCommittedHiddenTail := hiddenResp.CommittedHiddenTail
		newCommittedHiddenTailSeqno := newCommittedHiddenTail.Seqno
		lastCommittedHiddenTailSeqno = newCommittedHiddenTailSeqno

		// ensure the server is self consistent in its answer
		if hiddenResp.UncommittedSeqno < newCommittedHiddenTailSeqno {
			return false, fmt.Errorf("The server claims that the lastHiddenSeqno for this team (seqno %v) is smaller than the one in the blind merkle update it sent (%v)", hiddenResp.UncommittedSeqno, newCommittedHiddenTailSeqno)
		}
		// prevent rollbacks in the blind tree
		if newCommittedHiddenTailSeqno < oldCommittedHiddenTailSeqno {
			return false, fmt.Errorf("Server rollback of the blind merkle tree leaf: we had previously seen a leaf at seqno %v, but this update contains a leaf at seqno %v", oldCommittedHiddenTailSeqno, newCommittedHiddenTailSeqno)
		}
		// add ratchet to ensure consistency
		err = l.AddUnblindedRatchet(mctx, newCommittedHiddenTail, 0 /*int(mctx.G().Clock().Now().Unix())*/, keybase1.RatchetType_BLINDED)
		if err != nil {
			return false, err
		}
		err = l.SetLastCommittedSeqno(mctx, newCommittedHiddenTailSeqno)
		if err != nil {
			return false, err
		}
	case libkb.MerkleHiddenResponseTypeABSENCEPROOF:
		if oldCommittedHiddenTailSeqno > 0 {
			return false, fmt.Errorf("Server claimed (and proved) there are no committed hidden chain links in the chain, but we had previously seen a committed link with seqno %v", oldCommittedHiddenTailSeqno)
		}
	default:
		return false, fmt.Errorf("Unrecognized response type: %v", hiddenResp.RespType)
	}

	if err := l.VerifyOldChainLinksAreCommitted(mctx, lastCommittedHiddenTailSeqno); err != nil {
		return false, err
	}

	if oldHiddenTailSeqno == hiddenResp.UncommittedSeqno {
		hiddenIsFresh = true
	} else if oldHiddenTailSeqno < hiddenResp.UncommittedSeqno {
		hiddenIsFresh = false
	} else {
		return false, fmt.Errorf("The server indicated that the last hidden link has Seqno %v, but we knew of a link with seqno %v already!", hiddenResp.UncommittedSeqno, oldHiddenTailSeqno)
	}

	return hiddenIsFresh, nil
}

// HasReaderPerTeamKeyAtGeneration returns true if the LoaderPackage has a sigchain entry for
// the PTK at the given generation. Whether in the preloaded data or the update.
func (l *LoaderPackage) HasReaderPerTeamKeyAtGeneration(gen keybase1.PerTeamKeyGeneration) bool {
	// RESTRICTEDBOTs are excluded since they do not have any PTK access
	if l.data == nil || l.role.IsRestrictedBot() {
		return false
	}
	_, ok := l.data.ReaderPerTeamKeys[gen]
	return ok
}

// Commit the update from the server to main HiddenTeamChain storage.
func (l *LoaderPackage) Commit(mctx libkb.MetaContext) error {
	if l.newData == nil {
		mctx.Debug("LoaderPackage#Commit: nil newData")
		return nil
	}
	mctx.Debug("LoaderPackage#Commit: %s", l.newData.Summary())
	err := mctx.G().GetHiddenTeamChainManager().Advance(mctx, *l.newData, l.expectedPrev)
	return err
}

// ChainData returns the merge of the preloaded hidden chain data and the recently downloaded chain update.
func (l *LoaderPackage) ChainData() *keybase1.HiddenTeamChain {
	return l.data
}

// MaxReaderTeamKeyGeneration returns the highest Reader PTK generation from the preloaded and hidden
// data.
func (l *LoaderPackage) MaxReaderPerTeamKeyGeneration() keybase1.PerTeamKeyGeneration {
	// RESTRICTEDBOTs are excluded since they do not have any PTK access
	if l.data == nil || l.role.IsRestrictedBot() {
		return keybase1.PerTeamKeyGeneration(0)
	}
	return l.data.MaxReaderPerTeamKeyGeneration()
}

func (l *LoaderPackage) RatchetBlindingKeySet() *RatchetBlindingKeySet {
	return l.rbks
}

func (l *LoaderPackage) SetRatchetBlindingKeySet(r *RatchetBlindingKeySet) {
	l.rbks = r
}

// AddRatchets calls AddRatchet on each SCTeamRatchet in v.
func (l *LoaderPackage) AddRatchets(mctx libkb.MetaContext, v []SCTeamRatchet, ctime int, typ keybase1.RatchetType) (err error) {
	for _, r := range v {
		err := l.AddRatchet(mctx, r, ctime, typ)
		if err != nil {
			return err
		}
	}
	return nil
}

// AddRatchet is called whenever we pull a ratchet out of a visible team link. The first thing we'll need to
// do is to make sure that we can look the unblinded ratchet up using the blinding keys we got down from the
// server. Then we'll check the ratchets again the old (loaded) and new (downloaded) data. Finally, we'll
// ensure that this ratchet doesn't clash another ratchet that came down in this update. If all checks work,
// then add this ratchet to the set of all new ratchets, and also the max ratchet set that we're keeping locally.
func (l *LoaderPackage) AddRatchet(mctx libkb.MetaContext, r SCTeamRatchet, ctime int, typ keybase1.RatchetType) (err error) {
	tail := l.rbks.Get(r)
	if tail == nil {
		return NewLoaderError("missing unblind for ratchet %s", r.String())
	}
	return l.AddUnblindedRatchet(mctx, tail, ctime, typ)
}

func (l *LoaderPackage) AddUnblindedRatchet(mctx libkb.MetaContext, tail *sig3.Tail, ctime int, typ keybase1.RatchetType) (err error) {
	ratchet := keybase1.LinkTripleAndTime{
		Triple: tail.Export(),
		Time:   keybase1.TimeFromSeconds(int64(ctime)),
	}
	err = checkRatchet(mctx, l.data, ratchet)
	if err != nil {
		return err
	}
	err = checkRatchet(mctx, l.newData, ratchet)
	if err != nil {
		return err
	}
	if l.allNewRatchets == nil {
		l.allNewRatchets = make(map[keybase1.Seqno]keybase1.LinkTripleAndTime)
	}
	q := ratchet.Triple.Seqno
	found, ok := l.allNewRatchets[q]
	if ok && !found.Triple.LinkID.Eq(ratchet.Triple.LinkID) {
		return NewLoaderError("ratchet for seqno %d contradicts another ratchet", q)
	}
	if !ok {
		l.allNewRatchets[q] = ratchet
	}
	l.newRatchetSet.Add(typ, ratchet)
	return nil
}

func (l *LoaderPackage) checkParentPointer(mctx libkb.MetaContext, getter func(q keybase1.Seqno) (keybase1.LinkID, bool), parentPointer keybase1.LinkTriple, fullLoad bool) (err error) {
	q := parentPointer.Seqno
	link, ok := getter(q)
	switch {
	case !ok && fullLoad:
		return newParentPointerError(q, "link wasn't found in parent chain")
	case !ok && !fullLoad:
		return nil
	}
	if !link.Eq(parentPointer.LinkID) {
		return newParentPointerError(q, "link ID mismatch")
	}
	if parentPointer.SeqType != keybase1.SeqType_SEMIPRIVATE {
		return newParentPointerError(q, "wrong chain type")
	}
	return nil
}

// CheckParentPointersOnFullLoad looks at all of the new hidden links we got down and makes sure that they
// the point to loaded links in the visible chain. Because it's a full load, the pointers must land. They
// can dangle on FTL loads, for instance.
func (l *LoaderPackage) CheckParentPointersOnFullLoad(mctx libkb.MetaContext, team *keybase1.TeamData) (err error) {
	if l.newData == nil {
		return nil
	}
	getter := func(q keybase1.Seqno) (ret keybase1.LinkID, found bool) {
		if team == nil {
			return ret, false
		}
		ret, found = team.Chain.LinkIDs[q]
		return ret, found
	}
	for _, v := range l.newData.Inner {
		if err := l.checkParentPointer(mctx, getter, v.ParentChain, true /* full load */); err != nil {
			return err
		}
	}
	return nil
}

// CheckParentPointersOnFastLoad looks at all of the new hidden links we got down and makes sure that they
// the point to loaded links in the visible chain. Because it's a fast load, the pointers can dangle.
func (l *LoaderPackage) CheckParentPointersOnFastLoad(mctx libkb.MetaContext, team *keybase1.FastTeamData) (err error) {
	if l.newData == nil {
		return nil
	}
	getter := func(q keybase1.Seqno) (ret keybase1.LinkID, found bool) {
		if team == nil {
			return ret, false
		}
		ret, found = team.Chain.LinkIDs[q]
		return ret, found
	}
	for _, v := range l.newData.Inner {
		if err := l.checkParentPointer(mctx, getter, v.ParentChain, false /* full load */); err != nil {
			return err
		}
	}
	return nil
}
