package teams

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/sig3"
	"github.com/keybase/client/go/teams/hidden"
	storage "github.com/keybase/client/go/teams/storage"
)

//
// ftl.go
//
// Fast Team chain Loader
//
// Routines for fast-team loading. In fast team loading, we ignore most signatures
// and use the Merkle Tree as a source of truth. This is good enough for getting
// directly into a chat, where it's not necessary to see a list of team members.
//

// FastTeamChainLoader loads teams using the "fast approach." It doesn't compute
// membership or check any signatures. It just checks for consistency against the merkle
// tree, and audits that the merkle tree is being faithfully constructed.
type FastTeamChainLoader struct {

	// context for loading things from the outside world.
	world LoaderContext

	// single-flight lock on TeamID
	locktab *libkb.LockTable

	// Hold onto FastTeamLoad by-products as long as we have room, and store
	// them persistently to disk.
	storage *storage.FTLStorage

	// Feature-flagging is powered by the server. If we get feature flagged off, we
	// won't retry for another hour.
	featureFlagGate *libkb.FeatureFlagGate

	// We can get pushed by the server into "force repoll" mode, in which we're
	// not getting cache invalidations. An example: when Coyne or Nojima revokes
	// a device. We want to cut down on notification spam. So instead, all attempts
	// to load a team result in a preliminary poll for freshness, which this state is enabled.
	forceRepollMutex sync.RWMutex
	forceRepollUntil gregor.TimeOrOffset
}

const FTLVersion = 1

// NewFastLoader makes a new fast loader and initializes it.
func NewFastTeamLoader(g *libkb.GlobalContext) *FastTeamChainLoader {
	ret := &FastTeamChainLoader{
		world:           NewLoaderContextFromG(g),
		featureFlagGate: libkb.NewFeatureFlagGate(libkb.FeatureFTL, 2*time.Minute),
		locktab:         libkb.NewLockTable(),
	}
	ret.storage = storage.NewFTLStorage(g, ret.upgradeStoredState)
	return ret
}

// NewFastTeamLoaderAndInstall creates a new loader and installs it into G.
func NewFastTeamLoaderAndInstall(g *libkb.GlobalContext) *FastTeamChainLoader {
	l := NewFastTeamLoader(g)
	g.SetFastTeamLoader(l)
	g.AddLogoutHook(l, "fastTeamLoader")
	g.AddDbNukeHook(l, "fastTeamLoader")
	return l
}

var _ libkb.FastTeamLoader = (*FastTeamChainLoader)(nil)

func ftlLogTag(m libkb.MetaContext) libkb.MetaContext {
	return m.WithLogTag("FTL")
}

func FTL(m libkb.MetaContext, arg keybase1.FastTeamLoadArg) (res keybase1.FastTeamLoadRes, err error) {
	return m.G().GetFastTeamLoader().Load(m, arg)
}

type ftlCombinedData struct {
	visible *keybase1.FastTeamData
	hidden  *keybase1.HiddenTeamChain
}

func newFTLCombinedData(v *keybase1.FastTeamData, h *keybase1.HiddenTeamChain) ftlCombinedData {
	return ftlCombinedData{visible: v, hidden: h}
}

func (f ftlCombinedData) latestKeyGeneration() keybase1.PerTeamKeyGeneration {
	ret := f.visible.LatestKeyGeneration
	g := f.hidden.MaxReaderPerTeamKeyGeneration()
	if ret < g {
		ret = g
	}
	return ret
}

func (f ftlCombinedData) perTeamKey(g keybase1.PerTeamKeyGeneration) *keybase1.PerTeamKey {
	ret, ok := f.visible.Chain.PerTeamKeys[g]
	if ok {
		return &ret
	}
	ret, ok = f.hidden.GetReaderPerTeamKeyAtGeneration(g)
	if ok {
		return &ret
	}
	return nil
}

// Load fast-loads the given team. Provide some hints as to how to load it. You can specify an application
// and key generations needed, if you are entering chat. Those links will be returned unstubbed
// from the server, and then the keys can be output in the result.
func (f *FastTeamChainLoader) Load(m libkb.MetaContext, arg keybase1.FastTeamLoadArg) (res keybase1.FastTeamLoadRes, err error) {
	m = ftlLogTag(m)
	defer m.TraceTimed(fmt.Sprintf("FastTeamChainLoader#Load(%+v)", arg), func() error { return err })()
	originalArg := arg.DeepCopy()

	err = f.featureFlagGate.ErrorIfFlagged(m)
	if err != nil {
		return res, err
	}

	res, err = f.loadOneAttempt(m, arg)
	if err != nil {
		return res, err
	}

	if arg.AssertTeamName != nil && !arg.AssertTeamName.Eq(res.Name) {
		m.Debug("Did not get expected subteam name; will reattempt with forceRefresh (%s != %s)", arg.AssertTeamName.String(), res.Name.String())
		arg.ForceRefresh = true
		res, err = f.loadOneAttempt(m, arg)
		if err != nil {
			return res, err
		}
		if !arg.AssertTeamName.Eq(res.Name) {
			return res, NewBadNameError(fmt.Sprintf("After force-refresh, still bad team name: wanted %s, but got %s", arg.AssertTeamName.String(), res.Name.String()))
		}
	}

	if ShouldRunBoxAudit(m) {
		newM, shouldReload := VerifyBoxAudit(m, res.Name.ToTeamID(arg.Public))
		if shouldReload {
			return f.Load(newM, originalArg)
		}
	} else {
		m.Debug("Box auditor feature flagged off; not checking jail during ftl team load...")
	}

	return res, nil
}

// VerifyTeamName verifies that the given ID aligns with the given name, using the Merkle tree only
// (and not verifying sigs along the way).
func (f *FastTeamChainLoader) VerifyTeamName(m libkb.MetaContext, id keybase1.TeamID, name keybase1.TeamName, forceRefresh bool) (err error) {
	m = m.WithLogTag("FTL")
	defer m.Trace(fmt.Sprintf("FastTeamChainLoader#VerifyTeamName(%v,%s)", id, name.String()), func() error { return err })()
	_, err = f.Load(m, keybase1.FastTeamLoadArg{
		ID:             id,
		Public:         id.IsPublic(),
		AssertTeamName: &name,
		ForceRefresh:   forceRefresh,
	})
	return err
}

func (f *FastTeamChainLoader) loadOneAttempt(m libkb.MetaContext, arg keybase1.FastTeamLoadArg) (res keybase1.FastTeamLoadRes, err error) {

	if arg.ID.IsPublic() != arg.Public {
		return res, NewBadPublicError(arg.ID, arg.Public)
	}

	flr, err := f.load(m, fastLoadArg{FastTeamLoadArg: arg})
	if err != nil {
		return res, err
	}

	res.ApplicationKeys = flr.applicationKeys
	res.Name, err = f.verifyTeamNameViaParentLoad(m, arg.ID, arg.Public, flr.unverifiedName, flr.upPointer, arg.ID, arg.ForceRefresh)
	if err != nil {
		return res, err
	}

	return res, nil
}

// verifyTeamNameViaParentLoad takes a team ID, and a pointer to a parent team's sigchain, and computes
// the full resolved team name. If the pointer is null, we'll assume this is a root team and do the
// verification via hash-comparison.
func (f *FastTeamChainLoader) verifyTeamNameViaParentLoad(m libkb.MetaContext, id keybase1.TeamID, isPublic bool, unverifiedName keybase1.TeamName, parent *keybase1.UpPointer, bottomSubteam keybase1.TeamID, forceRefresh bool) (res keybase1.TeamName, err error) {

	defer m.Trace(fmt.Sprintf("FastTeamChainLoader#verifyTeamNameViaParentLoad(%s,%s)", id, unverifiedName), func() error { return err })()

	if parent == nil {
		if !unverifiedName.IsRootTeam() {
			return res, NewBadNameError("expected a root team")
		}
		if !unverifiedName.ToTeamID(isPublic).Eq(id) {
			return res, NewBadNameError("root team v. team ID mismatch")
		}
		return unverifiedName, nil
	}

	if parent.ParentID.IsPublic() != isPublic {
		return res, NewBadPublicError(parent.ParentID, isPublic)
	}

	parentRes, err := f.load(m, fastLoadArg{
		FastTeamLoadArg: keybase1.FastTeamLoadArg{
			ID:           parent.ParentID,
			Public:       isPublic,
			ForceRefresh: forceRefresh,
		},
		downPointersNeeded:    []keybase1.Seqno{parent.ParentSeqno},
		needLatestName:        true,
		readSubteamID:         bottomSubteam,
		hiddenChainIsOptional: true, // we do not need to see the hidden chain for the parent
	})
	if err != nil {
		return res, err
	}
	downPointer, ok := parentRes.downPointers[parent.ParentSeqno]
	if !ok {
		return res, NewBadNameError("down pointer not found in parent")
	}
	suffix := downPointer.NameComponent

	parentName, err := f.verifyTeamNameViaParentLoad(m, parent.ParentID, isPublic, parentRes.unverifiedName, parentRes.upPointer, bottomSubteam, forceRefresh)
	if err != nil {
		return res, err
	}

	return parentName.Append(suffix)
}

// fastLoadRes is used internally to convey the results of the #load() call.
type fastLoadRes struct {
	applicationKeys []keybase1.TeamApplicationKey
	unverifiedName  keybase1.TeamName
	downPointers    map[keybase1.Seqno]keybase1.DownPointer
	upPointer       *keybase1.UpPointer
}

// fastLoadRes is used internally to pass arguments to the #load() call. It is a small wrapper
// around the keybase1.FastTeamLoadArg that's passed through to the public #Load() call.
type fastLoadArg struct {
	keybase1.FastTeamLoadArg
	downPointersNeeded    []keybase1.Seqno
	readSubteamID         keybase1.TeamID
	needLatestName        bool
	forceReset            bool
	hiddenChainIsOptional bool
}

// needChainTail returns true if the argument mandates that we need a reasonably up-to-date chain tail,
// let's say to figure out what this team is currently named, or to figure out the most recent
// encryption key to encrypt new messages for.
func (a fastLoadArg) needChainTail() bool {
	return a.needLatestName || a.NeedLatestKey
}

// load acquires a lock by team ID, and the runs loadLockedWithRetries.
func (f *FastTeamChainLoader) load(m libkb.MetaContext, arg fastLoadArg) (res *fastLoadRes, err error) {

	defer m.Trace(fmt.Sprintf("FastTeamChainLoader#load(%+v)", arg), func() error { return err })()

	// Single-flight lock by team ID.
	lock := f.locktab.AcquireOnName(m.Ctx(), m.G(), arg.ID.String())
	defer lock.Release(m.Ctx())

	return f.loadLockedWithRetries(m, arg)
}

// loadLockedWithRetries attempts two loads of the team. If the first iteration returns an FTLMissingSeedError,
// we'll blast through the cache and attempt a full reload a second time. Then that's for all the marbles.
func (f *FastTeamChainLoader) loadLockedWithRetries(m libkb.MetaContext, arg fastLoadArg) (res *fastLoadRes, err error) {

	for i := 0; i < 2; i++ {
		res, err = f.loadLocked(m, arg)
		if err == nil {
			return res, err
		}
		if _, ok := err.(FTLMissingSeedError); !ok {
			return nil, err
		}
		m.Debug("Got retriable error %s; will force reset", err)
		arg.forceReset = true
	}
	return res, err
}

// dervieSeedAtGeneration either goes to cache or rederives the PTK private seed
// for the given generation gen.
func (f *FastTeamChainLoader) deriveSeedAtGeneration(m libkb.MetaContext, gen keybase1.PerTeamKeyGeneration, dat ftlCombinedData) (seed keybase1.PerTeamKeySeed, err error) {

	state := dat.visible

	seed, ok := state.Chain.PerTeamKeySeedsVerified[gen]
	if ok {
		return seed, nil
	}

	var tmp keybase1.PerTeamKeySeed
	tmp, ok = state.PerTeamKeySeedsUnverified[gen]
	if !ok {
		// See CORE-9207. We can hit this case if we previously loaded a parent team for verifying a subteam
		// name before we were members of the team, and then later get added to the team, and then try to
		// reload the team. We didn't have boxes from the first time around, so just force a full reload.
		// It's inefficient but it's a very rare case.
		return seed, NewFTLMissingSeedError(gen)
	}

	ptkChain := dat.perTeamKey(gen)
	if ptkChain == nil {
		return seed, NewFastLoadError(fmt.Sprintf("no per team key public halves at generation %d", gen))
	}

	check, ok := state.SeedChecks[gen]
	if !ok {
		return seed, NewFastLoadError(fmt.Sprintf("no per team key seed check at %d", gen))
	}

	km, err := NewTeamKeyManagerWithSecret(state.ID(), tmp, gen, &check)
	if err != nil {
		return seed, err
	}

	sigKey, err := km.SigningKey()
	if err != nil {
		return seed, err
	}

	if !ptkChain.SigKID.SecureEqual(sigKey.GetKID()) {
		m.Debug("sig KID gen:%v (local) %v != %v (chain)", gen, sigKey.GetKID(), ptkChain.SigKID)
		return seed, NewFastLoadError(fmt.Sprintf("wrong team key (sig) found at generation %v", gen))
	}

	encKey, err := km.EncryptionKey()
	if err != nil {
		return seed, err
	}

	if !ptkChain.EncKID.SecureEqual(encKey.GetKID()) {
		m.Debug("enc KID gen:%v (local) %v != %v (chain)", gen, encKey.GetKID(), ptkChain.EncKID)
		return seed, NewFastLoadError(fmt.Sprintf("wrong team key (enc) found at generation %v", gen))
	}

	// write back to cache
	seed = tmp
	state.Chain.PerTeamKeySeedsVerified[gen] = seed
	return seed, err
}

// deriveKeyForApplicationAtGeneration pulls from cache or generates the PTK for the
// given application at the given generation.
func (f *FastTeamChainLoader) deriveKeyForApplicationAtGeneration(m libkb.MetaContext, app keybase1.TeamApplication, gen keybase1.PerTeamKeyGeneration, dat ftlCombinedData) (key keybase1.TeamApplicationKey, err error) {

	seed, err := f.deriveSeedAtGeneration(m, gen, dat)
	if err != nil {
		return key, err
	}

	var mask *keybase1.MaskB64
	if m := dat.visible.ReaderKeyMasks[app]; m != nil {
		tmp, ok := m[gen]
		if ok {
			mask = &tmp
		}
	}
	if mask == nil {
		m.Debug("Could not get reader key mask for <%s,%d>", app, gen)
		if dat.visible.ID().IsSubTeam() {
			m.Debug("guessing lack of RKM is due to not being an explicit member of the subteam")
			return key, NewNotExplicitMemberOfSubteamError()
		}
		return key, NewFastLoadError("Could not load application keys")
	}

	rkm := keybase1.ReaderKeyMask{
		Application: app,
		Generation:  gen,
		Mask:        *mask,
	}
	return applicationKeyForMask(rkm, seed)
}

// deriveKeysForApplication pulls from cache or generates several geneartions of PTKs
// for the given application.
func (f *FastTeamChainLoader) deriveKeysForApplication(m libkb.MetaContext, app keybase1.TeamApplication, arg fastLoadArg, dat ftlCombinedData) (keys []keybase1.TeamApplicationKey, err error) {

	latestGen := dat.latestKeyGeneration()

	var didLatest bool
	doKey := func(gen keybase1.PerTeamKeyGeneration) error {
		var key keybase1.TeamApplicationKey
		key, err = f.deriveKeyForApplicationAtGeneration(m, app, gen, dat)
		if err != nil {
			return err
		}
		keys = append(keys, key)
		if gen == latestGen {
			didLatest = true
		}
		return nil
	}

	if arg.NeedLatestKey {
		// This debug is useful to have since it will spell out which version is the latest in the log
		// if the caller asked for latest.
		m.Debug("FastTeamChainLoader#deriveKeysForApplication: sending back latest at key generation %d", latestGen)
	}

	for _, gen := range arg.KeyGenerationsNeeded {
		if err = doKey(gen); err != nil {
			return nil, err
		}
	}
	if !didLatest && arg.NeedLatestKey {
		if err = doKey(latestGen); err != nil {
			return nil, err
		}
	}
	return keys, nil
}

// deriveKeys pulls from cache or generates PTKs for an set of (application X generations)
// pairs, for all in the cartesian product.
func (f *FastTeamChainLoader) deriveKeys(m libkb.MetaContext, arg fastLoadArg, dat ftlCombinedData) (keys []keybase1.TeamApplicationKey, err error) {
	for _, app := range arg.Applications {
		var tmp []keybase1.TeamApplicationKey
		tmp, err = f.deriveKeysForApplication(m, app, arg, dat)
		if err != nil {
			return nil, err
		}
		keys = append(keys, tmp...)
	}
	return keys, nil
}

// toResult turns the current fast state into a fastLoadRes.
func (f *FastTeamChainLoader) toResult(m libkb.MetaContext, arg fastLoadArg, dat ftlCombinedData) (res *fastLoadRes, err error) {
	res = &fastLoadRes{
		unverifiedName: dat.visible.Name,
		downPointers:   dat.visible.Chain.DownPointers,
		upPointer:      dat.visible.Chain.LastUpPointer,
	}
	res.applicationKeys, err = f.deriveKeys(m, arg, dat)
	if err != nil {
		return nil, err
	}
	return res, nil
}

// findState in cache finds the team ID's state in an in-memory cache.
func (f *FastTeamChainLoader) findStateInCache(m libkb.MetaContext, id keybase1.TeamID) (data *keybase1.FastTeamData, frozen bool, tombstoned bool) {
	return f.storage.Get(m, id, id.IsPublic())
}

// stateHasKeySeed returns true/false if the state has the seed material for the given
// generation. Either the fully verified PTK seed, or the public portion and
// unverified PTK seed.
func stateHasKeySeed(m libkb.MetaContext, gen keybase1.PerTeamKeyGeneration, state *keybase1.FastTeamData) bool {
	_, foundVerified := state.Chain.PerTeamKeySeedsVerified[gen]
	if foundVerified {
		return true
	}
	_, foundUnverifiedSeed := state.PerTeamKeySeedsUnverified[gen]
	if !foundUnverifiedSeed {
		return false
	}
	_, foundPerTeamKey := state.Chain.PerTeamKeys[gen]
	return foundPerTeamKey
}

// stateHasKeys checks to see if the given state has the keys specified in the shopping list. If not, it will
// modify the shopping list and return false. If yes, it will leave the shopping list unchanged and return
// true.
func stateHasKeys(m libkb.MetaContext, shoppingList *shoppingList, arg fastLoadArg, data ftlCombinedData) (fresh bool) {
	gens := make(map[keybase1.PerTeamKeyGeneration]struct{})
	state := data.visible

	fresh = true

	if arg.NeedLatestKey && !state.LoadedLatest {
		m.Debug("latest was never loaded, we need to load it")
		shoppingList.needMerkleRefresh = true
		shoppingList.needLatestKey = true
		fresh = false
	}

	// The key generations needed are the ones passed in, and also, potentially, our cached
	// LatestKeyGeneration from the state. It could be that when we go to the server, this is no
	// longer the LatestKeyGeneration, but it might be. It depends. But in either case, we should
	// pull down the mask, since it's a bug to not have it if it turns out the server refresh
	// didn't budge the latest key generation.
	kgn := append([]keybase1.PerTeamKeyGeneration{}, arg.KeyGenerationsNeeded...)
	latestKeyGeneration := data.latestKeyGeneration()
	if arg.NeedLatestKey && state.LoadedLatest && latestKeyGeneration > 0 {
		kgn = append(kgn, latestKeyGeneration)
	}

	for _, app := range arg.Applications {
		for _, gen := range kgn {
			add := false
			if state.ReaderKeyMasks[app] == nil || state.ReaderKeyMasks[app][gen] == nil {
				m.Debug("state doesn't have mask for <%d,%d>", app, gen)
				add = true
			}
			if !stateHasKeySeed(m, gen, state) {
				m.Debug("state doesn't have key seed for gen=%d", gen)
				add = true
			}
			if add {
				gens[gen] = struct{}{}
				fresh = false
			}
		}
	}

	shoppingList.applications = append([]keybase1.TeamApplication{}, arg.Applications...)

	if !fresh {
		for gen := range gens {
			shoppingList.generations = append(shoppingList.generations, gen)
		}
	}

	// Let's just get all keys from the past, so figure out the minimal seed value that we have.
	shoppingList.seedLow = computeSeedLow(state)

	return fresh
}

// stateHasDownPointers checks to see if the given state has the down pointers specified in the shopping list.
// If not, it will change the shopping list to have the down pointers and return false. If yes, it will
// leave the shopping list unchanged and return true.
func stateHasDownPointers(m libkb.MetaContext, shoppingList *shoppingList, arg fastLoadArg, state *keybase1.FastTeamData) (ret bool) {
	ret = true

	for _, seqno := range arg.downPointersNeeded {
		if _, ok := state.Chain.DownPointers[seqno]; !ok {
			m.Debug("Down pointer at seqno=%d wasn't found", seqno)
			shoppingList.addDownPointer(seqno)
			ret = false
		}
	}
	return ret
}

// computeSeedLow computes the value for ftl_seed_low that we're going to send up to the server for fetches.
func computeSeedLow(state *keybase1.FastTeamData) keybase1.PerTeamKeyGeneration {
	if state.MaxContinuousPTKGeneration > 0 {
		return state.MaxContinuousPTKGeneration
	}
	var ret keybase1.PerTeamKeyGeneration
	for i := keybase1.PerTeamKeyGeneration(1); i <= state.LatestKeyGeneration; i++ {
		_, found := state.PerTeamKeySeedsUnverified[i]
		if !found {
			break
		}
		ret = i
	}
	state.MaxContinuousPTKGeneration = ret
	return ret
}

// shoppingList is a list of what we need from the server.
type shoppingList struct {
	needMerkleRefresh bool // if we need to refresh the Merkle path for this team
	needLatestKey     bool // true if we never loaded the latest mask, and need to do it

	// links *and* PTKs newer than the given seqno. And RKMs for
	// the given apps.
	linksSince   keybase1.Seqno
	downPointers []keybase1.Seqno

	// The applications we care about.
	applications []keybase1.TeamApplication

	// The generations we care about. We'll always get back the most recent RKMs
	// if we send a needMerkleRefresh.
	seedLow     keybase1.PerTeamKeyGeneration
	generations []keybase1.PerTeamKeyGeneration

	// the last hidden link we got, in case we need to download more
	hiddenLinksSince keybase1.Seqno
}

// groceries are what we get back from the server.
type groceries struct {
	newLinks          []*ChainLinkUnpacked
	rkms              []keybase1.ReaderKeyMask
	latestKeyGen      keybase1.PerTeamKeyGeneration
	seeds             []keybase1.PerTeamKeySeed
	newHiddenLinks    []sig3.ExportJSON
	expMaxHiddenSeqno keybase1.Seqno
}

// isEmpty returns true if our shopping list is empty. In this case, we have no need to go to the
// server (store), and can just return with what's in our cache.
func (s shoppingList) isEmpty() bool {
	return !s.needMerkleRefresh && len(s.generations) == 0 && len(s.downPointers) == 0
}

// onlyNeedsRefresh will be true if we only are going to the server for a refresh,
// say when encrypting for the latest key version. If the merkle tree says we're up to date,
// we can skip the team/get call.
func (s shoppingList) onlyNeedsRefresh() bool {
	return s.needMerkleRefresh && !s.needLatestKey && len(s.generations) == 0 && len(s.downPointers) == 0
}

// addDownPointer adds a down pointer to our shopping list. If we need to read naming information
// out of a parent team, we'll add the corresponding sequence number here. The we expect the
// payload JSON for the corrsponding seqno -- that we already have the wrapper chainlink v2
// that contains the hash of this payload JSON.
func (s *shoppingList) addDownPointer(seqno keybase1.Seqno) {
	s.downPointers = append(s.downPointers, seqno)
}

// computeWithPreviousState looks into the given load arg, and also our current cached state, to figure
// what to get from the server. The results are compiled into a "shopping list" that we'll later
// use when we concoct our server request.
func (f *FastTeamChainLoader) computeWithPreviousState(m libkb.MetaContext, s *shoppingList, arg fastLoadArg, data ftlCombinedData) {
	state := data.visible
	cachedAt := state.CachedAt.Time()
	s.linksSince = state.Chain.Last.Seqno

	if arg.forceReset {
		s.linksSince = keybase1.Seqno(0)
		m.Debug("forceReset specified, so reloading from low=0")
	}

	if arg.needChainTail() && m.G().Clock().Now().Sub(cachedAt) > time.Hour {
		m.Debug("cached value is more than an hour old (cached at %s)", cachedAt)
		s.needMerkleRefresh = true
	}
	if arg.needChainTail() && state.LatestSeqnoHint > state.Chain.Last.Seqno {
		m.Debug("cached value is stale: seqno %d > %d", state.LatestSeqnoHint, state.Chain.Last.Seqno)
		s.needMerkleRefresh = true
	}
	if arg.needChainTail() && data.hidden.IsStale() {
		m.Debug("HiddenTeamChain was stale, forcing refresh")
		s.needMerkleRefresh = true
	}
	if arg.ForceRefresh {
		m.Debug("refresh forced via flag")
		s.needMerkleRefresh = true
	}
	if !s.needMerkleRefresh && f.InForceRepollMode(m) {
		m.Debug("must repoll since in force mode")
		s.needMerkleRefresh = true
	}
	if !stateHasKeys(m, s, arg, data) {
		m.Debug("state was missing needed encryption keys, or we need the freshest")
	}
	if !stateHasDownPointers(m, s, arg, state) {
		m.Debug("state was missing unstubbed links")
	}
}

// computeFreshLoad computes a shopping list from a fresh load of the state.
func (s *shoppingList) computeFreshLoad(m libkb.MetaContext, arg fastLoadArg) {
	s.needMerkleRefresh = true
	s.applications = append([]keybase1.TeamApplication{}, arg.Applications...)
	s.downPointers = append([]keybase1.Seqno{}, arg.downPointersNeeded...)
	s.generations = append([]keybase1.PerTeamKeyGeneration{}, arg.KeyGenerationsNeeded...)
}

func (s *shoppingList) addHiddenLow(hp *hidden.LoaderPackage) {
	s.hiddenLinksSince = hp.LastSeqno()
}

// applicationsToString converts the list of applications to a comma-separated string.
func applicationsToString(applications []keybase1.TeamApplication) string {
	var tmp []string
	for _, k := range applications {
		tmp = append(tmp, fmt.Sprintf("%d", int(k)))
	}
	return strings.Join(tmp, ",")
}

// generationsToString converts the list of generations to a comma-separated string.
func generationsToString(generations []keybase1.PerTeamKeyGeneration) string {
	var tmp []string
	for _, k := range generations {
		tmp = append(tmp, fmt.Sprintf("%d", int(k)))
	}
	return strings.Join(tmp, ",")
}

// toHTTPArgs turns our shopping list into what we need from the server. Here is what we need:
// all stubs since `low`, which might be 0, in which case all `stubs`. The first link we
// get back must be unstubbed. The last "up pointer" must be unstubbed. Any link in `seqnos`
// must be returned unstubbed, and might be in the sequence *before* `low`. We specify
// key generations and applications, and need reader key masks for all applications
// in the (apps X gens) cartesian product.
func (a fastLoadArg) toHTTPArgs(m libkb.MetaContext, s shoppingList) libkb.HTTPArgs {
	ret := libkb.HTTPArgs{
		"id":                  libkb.S{Val: a.ID.String()},
		"public":              libkb.B{Val: a.Public},
		"ftl":                 libkb.B{Val: true},
		"ftl_low":             libkb.I{Val: int(s.linksSince)},
		"ftl_seqnos":          libkb.S{Val: seqnosToString(s.downPointers)},
		"ftl_key_generations": libkb.S{Val: generationsToString(s.generations)},
		"ftl_version":         libkb.I{Val: FTLVersion},
		"ftl_seed_low":        libkb.I{Val: int(s.seedLow)},
	}
	if len(s.applications) > 0 {
		ret["ftl_include_applications"] = libkb.S{Val: applicationsToString(s.applications)}
	}
	if a.NeedLatestKey {
		ret["ftl_n_newest_key_generations"] = libkb.I{Val: int(3)}
	}
	if !a.readSubteamID.IsNil() {
		ret["read_subteam_id"] = libkb.S{Val: a.readSubteamID.String()}
	}
	if tmp := hidden.CheckFeatureGateForSupport(m, a.ID, false /* isWrite */); tmp == nil {
		ret["ftl_hidden_low"] = libkb.I{Val: int(s.hiddenLinksSince)}
	}
	return ret
}

// loadFromServerWithRetries loads the leaf in the merkle tree and then fetches from team/get.json the links
// needed for the team chain. There is a race possible, when a link is added between the two. In that
// case, refetch in a loop until we match up. It will retry in the case of GreenLinkErrors. If
// the given state was fresh already, then we'll return a nil groceries.
func (f *FastTeamChainLoader) loadFromServerWithRetries(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData, shoppingList shoppingList, hp *hidden.LoaderPackage) (groceries *groceries, err error) {

	defer m.Trace(fmt.Sprintf("FastTeamChainLoader#loadFromServerWithRetries(%s,%v)", arg.ID, arg.Public), func() error { return err })()

	const nRetries = 3
	for i := 0; i < nRetries; i++ {
		groceries, err = f.loadFromServerOnce(m, arg, state, shoppingList, hp)
		switch err.(type) {
		case nil:
			return groceries, nil
		case GreenLinkError:
			m.Debug("FastTeamChainLoader retrying after green link")
			continue
		default:
			return nil, err
		}
	}
	return nil, err
}

// makeHTTPRequest hits the HTTP GET endpoint for the team data.
func (f *FastTeamChainLoader) makeHTTPRequest(m libkb.MetaContext, args libkb.HTTPArgs, isPublic bool) (t rawTeam, err error) {
	apiArg := libkb.NewAPIArg("team/get")
	apiArg.Args = args
	if isPublic {
		apiArg.SessionType = libkb.APISessionTypeOPTIONAL
	} else {
		apiArg.SessionType = libkb.APISessionTypeREQUIRED
	}
	err = m.G().API.GetDecode(m, apiArg, &t)
	if err != nil {
		return t, err
	}
	return t, nil
}

// loadFromServerOnce turns the giving "shoppingList" into requests for the server, and then makes
// an HTTP GET to fetch the corresponding "groceries." Once retrieved, we unpack links, and
// check for "green" links --- those that might have been added to the team after the merkle update
// we previously read. If we find a green link, we retry in our caller. Otherwise, we also do the
// key decryption here, decrypting the most recent generation, and all prevs we haven't previously
// decrypted.
func (f *FastTeamChainLoader) loadFromServerOnce(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData, shoppingList shoppingList, hp *hidden.LoaderPackage) (ret *groceries, err error) {

	defer m.Trace("FastTeamChainLoader#loadFromServerOnce", func() error { return err })()

	var teamUpdate rawTeam
	var links []*ChainLinkUnpacked
	var lastSecretGen keybase1.PerTeamKeyGeneration
	var seeds []keybase1.PerTeamKeySeed
	var hiddenIsFresh bool

	lastSeqno, lastLinkID, hiddenResp, err := f.world.merkleLookupWithHidden(m.Ctx(), arg.ID, arg.Public)
	if err != nil {
		return nil, err
	}
	if hiddenResp.CommittedHiddenTail != nil {
		err = hp.SetLastCommittedSeqno(m, hiddenResp.CommittedHiddenTail.Seqno)
		if err != nil {
			return nil, err
		}
	}
	if !arg.hiddenChainIsOptional && hiddenResp.RespType == libkb.MerkleHiddenResponseTypeNONE {
		return nil, libkb.NewHiddenChainDataMissingError("the server did not return the necessary hidden chain data")
	}

	if hiddenResp.RespType != libkb.MerkleHiddenResponseTypeFLAGOFF && hiddenResp.RespType != libkb.MerkleHiddenResponseTypeNONE {
		hiddenIsFresh, err = hp.CheckHiddenMerklePathResponseAndAddRatchets(m, hiddenResp)
		if err != nil {
			return nil, err
		}
	} else {
		hiddenIsFresh = true
	}

	if shoppingList.onlyNeedsRefresh() && state != nil && state.Chain.Last != nil && state.Chain.Last.Seqno == lastSeqno && hiddenIsFresh {
		if !lastLinkID.Eq(state.Chain.Last.LinkID) {
			m.Debug("link ID mismatch at tail seqno %d: wanted %s but got %s", state.Chain.Last.LinkID, lastLinkID)
			return nil, NewFastLoadError("cached last link at seqno=%d did not match current merke tree", lastSeqno)
		}
		m.Debug("according to merkle tree, previously loaded chain at %d is current, and shopping list was empty", lastSeqno)
		return nil, nil
	}

	teamUpdate, err = f.makeHTTPRequest(m, arg.toHTTPArgs(m, shoppingList), arg.Public)
	if err != nil {
		f.featureFlagGate.DigestError(m, err)
		return nil, err
	}

	if !teamUpdate.ID.Eq(arg.ID) {
		return nil, NewFastLoadError("server returned wrong id: %v != %v", teamUpdate.ID, arg.ID)
	}
	links, err = teamUpdate.unpackLinks(m.Ctx())
	if err != nil {
		return nil, err
	}

	numStubbed := 0

	for _, link := range links {
		if link.Seqno() > lastSeqno {
			m.Debug("TeamLoader found green link seqno:%v", link.Seqno())
			return nil, NewGreenLinkError(link.Seqno())
		}
		if link.Seqno() == lastSeqno && !lastLinkID.Eq(link.LinkID().Export()) {
			m.Debug("Merkle tail mismatch at link %d: %v != %v", lastSeqno, lastLinkID, link.LinkID().Export())
			return nil, NewInvalidLink(link, "last link did not match merkle tree")
		}
		if link.isStubbed() {
			numStubbed++
		}
	}

	if teamUpdate.Box != nil {
		lastSecretGen, seeds, err = unboxPerTeamSecrets(m, f.world, teamUpdate.Box, teamUpdate.Prevs)
		if err != nil {
			return nil, err
		}
	}

	hp.SetRatchetBlindingKeySet(teamUpdate.RatchetBlindingKeySet)

	m.Debug("loadFromServerOnce: got back %d new links; %d stubbed; %d RKMs; %d prevs; box=%v; lastSecretGen=%d; %d hidden chainlinks", len(links), numStubbed, len(teamUpdate.ReaderKeyMasks), len(teamUpdate.Prevs), teamUpdate.Box != nil, lastSecretGen, len(teamUpdate.HiddenChain))

	return &groceries{
		newLinks:          links,
		latestKeyGen:      lastSecretGen,
		rkms:              teamUpdate.ReaderKeyMasks,
		seeds:             seeds,
		newHiddenLinks:    teamUpdate.HiddenChain,
		expMaxHiddenSeqno: hiddenResp.UncommittedSeqno,
	}, nil
}

// checkStubs makes sure that new links sent down from the server have the right stubbing/unstubbing
// pattern. The rules are: the most recent "up pointer" should be unstubbed. The first link should be
// unstubbed. The last key rotation should be unstubbed (though we can't really check this now).
// And any links we ask for should be unstubbed too.
func (f *FastTeamChainLoader) checkStubs(m libkb.MetaContext, shoppingList shoppingList, newLinks []*ChainLinkUnpacked, canReadTeam bool) (err error) {

	if len(newLinks) == 0 {
		return nil
	}

	isUpPointer := func(t libkb.SigchainV2Type) bool {
		return (t == libkb.SigchainV2TypeTeamRenameUpPointer) || (t == libkb.SigchainV2TypeTeamDeleteUpPointer)
	}

	isKeyRotation := func(link *ChainLinkUnpacked) bool {
		return (link.LinkType() == libkb.SigchainV2TypeTeamRotateKey) || (!link.isStubbed() && link.inner != nil && link.inner.Body.Key != nil)
	}

	// these are the links that we explicitly asked for from the server.
	neededSeqnos := make(map[keybase1.Seqno]bool)
	for _, s := range shoppingList.downPointers {
		neededSeqnos[s] = true
	}

	foundUpPointer := false
	foundKeyRotation := false
	for i := len(newLinks) - 1; i >= 0; i-- {
		link := newLinks[i]

		// Check that the most recent up pointer is unstubbed
		if !foundUpPointer && isUpPointer(link.LinkType()) {
			if link.isStubbed() {
				return NewInvalidLink(link, "expected last 'UP' pointer to be unstubbed")
			}
			foundUpPointer = true
		}

		// This check is approximate, since the server can hide key rotations, since they can be
		// included in membership changes.
		if !foundKeyRotation && isKeyRotation(link) {
			if link.isStubbed() {
				return NewInvalidLink(link, "we expected the last key rotation to be unstubbed")
			}
			foundKeyRotation = true
		}

		if neededSeqnos[link.Seqno()] && link.isStubbed() {
			return NewInvalidLink(link, "server sent back stubbed link, but we asked for unstubbed")
		}
	}

	if newLinks[0].isStubbed() && newLinks[0].Seqno() == keybase1.Seqno(1) {
		return NewInvalidLink(newLinks[0], "expected head link to be unstubbed")
	}

	return nil
}

func checkSeqType(m libkb.MetaContext, arg fastLoadArg, link *ChainLinkUnpacked) error {
	if link.SeqType() != keybase1.SeqType_NONE && ((arg.Public && link.SeqType() != keybase1.SeqType_PUBLIC) || (!arg.Public && link.SeqType() != keybase1.SeqType_SEMIPRIVATE)) {
		m.Debug("Bad seqtype at %v/%d: %d", arg.ID, link.Seqno(), link.SeqType())
		return NewInvalidLink(link, "bad seqtype")
	}
	return nil
}

// checkPrevs checks the previous pointers on the new links that came down from the server. It
// only checks prevs for links that are newer than the last link gotten in this chain.
// We assume the rest are expanding hashes for links we've previously downloaded.
func (f *FastTeamChainLoader) checkPrevs(m libkb.MetaContext, arg fastLoadArg, last *keybase1.LinkTriple, newLinks []*ChainLinkUnpacked) (err error) {
	if len(newLinks) == 0 {
		return nil
	}

	var prev keybase1.LinkTriple
	if last != nil {
		prev = *last
	}

	cmpHash := func(prev keybase1.LinkTriple, link *ChainLinkUnpacked) (err error) {

		// not ideal to have to export here, but it simplifies the code.
		prevex := link.Prev().Export()

		if prev.LinkID.IsNil() && prevex.IsNil() {
			return nil
		}
		if prev.LinkID.IsNil() || prevex.IsNil() {
			m.Debug("Bad prev nil/non-nil pointer check at seqno %d: (prev=%v vs curr=%v)", link.Seqno(), prev.LinkID.IsNil(), prevex.IsNil())
			return NewInvalidLink(link, "bad nil/non-nil prev pointer comparison")
		}
		if !prev.LinkID.Eq(prevex) {
			m.Debug("Bad prev comparison at seqno %d: %s != %s", prev.LinkID, prevex)
			return NewInvalidLink(link, "bad prev pointer")
		}
		return nil
	}

	cmpSeqnos := func(prev keybase1.LinkTriple, link *ChainLinkUnpacked) (err error) {
		if prev.Seqno+1 != link.Seqno() {
			m.Debug("Bad sequence violation: %d+1 != %d", prev.Seqno, link.Seqno())
			return NewInvalidLink(link, "seqno violation")
		}
		return checkSeqType(m, arg, link)
	}

	cmp := func(prev keybase1.LinkTriple, link *ChainLinkUnpacked) (err error) {
		err = cmpHash(prev, link)
		if err != nil {
			return err
		}
		return cmpSeqnos(prev, link)
	}

	for _, link := range newLinks {
		// We might have gotten some links from the past just for the purposes of expanding
		// previous links that were stubbed. We don't need to check prevs on them, since
		// we previously did.
		if last != nil && last.Seqno >= link.Seqno() {
			continue
		}
		err := cmp(prev, link)
		if err != nil {
			return err
		}
		prev = link.LinkTriple()
	}
	return nil
}

// audit runs probabilistic merkle tree audit on the new links, to make sure that the server isn't
// running odd-even-style attacks against members in a group.
func (f *FastTeamChainLoader) audit(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData) (err error) {
	head, ok := state.Chain.MerkleInfo[1]
	if !ok {
		return NewAuditError("cannot run audit without merkle info for head")
	}
	last := state.Chain.Last
	if last == nil {
		return NewAuditError("cannot run audit, no last chain data")
	}
	return m.G().GetTeamAuditor().AuditTeam(m, arg.ID, arg.Public, head.Seqno, state.Chain.LinkIDs, last.Seqno, keybase1.AuditMode_STANDARD)
}

// readDownPointer reads a down pointer out of a given link, if it's unstubbed. Down pointers
// are (1) new_subteams; (2) subteam rename down pointers; and (3) subteam delete down pointers.
// Will return (nil, non-nil) if there is an error.
func readDownPointer(m libkb.MetaContext, link *ChainLinkUnpacked) (*keybase1.DownPointer, error) {
	if link.inner == nil || link.inner.Body.Team == nil || link.inner.Body.Team.Subteam == nil {
		return nil, nil
	}
	subteam := link.inner.Body.Team.Subteam
	typ := link.LinkType()
	if typ != libkb.SigchainV2TypeTeamNewSubteam && typ != libkb.SigchainV2TypeTeamRenameSubteam && typ != libkb.SigchainV2TypeTeamDeleteSubteam {
		return nil, nil
	}
	del := (typ == libkb.SigchainV2TypeTeamDeleteSubteam)
	if len(subteam.Name) == 0 && len(subteam.ID) == 0 {
		return nil, nil
	}
	lastPart, err := subteam.Name.LastPart()
	if err != nil {
		return nil, err
	}
	xid, err := subteam.ID.ToTeamID()
	if err != nil {
		return nil, err
	}
	return &keybase1.DownPointer{
		Id:            xid,
		NameComponent: lastPart,
		IsDeleted:     del,
	}, nil
}

// readMerkleRoot reads the merkle root out of the link if this link is unstubbed.
func readMerkleRoot(m libkb.MetaContext, link *ChainLinkUnpacked) (*keybase1.MerkleRootV2, error) {
	if link.inner == nil {
		return nil, nil
	}
	ret := link.inner.Body.MerkleRoot.ToMerkleRootV2()
	return &ret, nil
}

// readUpPointer reads an up pointer out the given link, if it's unstubbed. Up pointers are
// (1) subteam heads; (2) subteam rename up pointers; and (3) subteam delete up pointers.
// Will return (nil, non-nil) if we hit any error condition.
func readUpPointer(m libkb.MetaContext, arg fastLoadArg, link *ChainLinkUnpacked) (*keybase1.UpPointer, error) {
	if link.inner == nil || link.inner.Body.Team == nil || link.inner.Body.Team.Parent == nil {
		return nil, nil
	}
	parent := link.inner.Body.Team.Parent
	typ := link.LinkType()
	if typ != libkb.SigchainV2TypeTeamSubteamHead && typ != libkb.SigchainV2TypeTeamRenameUpPointer && typ != libkb.SigchainV2TypeTeamDeleteUpPointer {
		return nil, nil
	}
	xid, err := parent.ID.ToTeamID()
	if err != nil {
		return nil, err
	}

	err = checkSeqType(m, arg, link)
	if err != nil {
		return nil, err
	}
	return &keybase1.UpPointer{
		OurSeqno:    link.Seqno(),
		ParentID:    xid,
		ParentSeqno: parent.Seqno,
		Deletion:    (typ == libkb.SigchainV2TypeTeamDeleteUpPointer),
	}, nil
}

// putName takes the name out of the team (or subteam) head and stores it to state.
// In the case of a subteam, this name has not been verified, and we should
// verify it ourselves against the merkle tree.
func (f *FastTeamChainLoader) putName(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData, newLinks []*ChainLinkUnpacked) (err error) {
	if len(newLinks) == 0 || newLinks[0].Seqno() != keybase1.Seqno(1) {
		return nil
	}
	head := newLinks[0]
	if head.isStubbed() {
		return NewInvalidLink(head, "head should never be stubbed")
	}
	if head.inner.Body.Team == nil || head.inner.Body.Team.Name == nil {
		return NewInvalidLink(head, "head name should never be nil")
	}
	nm := *head.inner.Body.Team.Name
	xname, err := keybase1.TeamNameFromString(string(nm))
	if err != nil {
		return err
	}
	if !state.Name.IsNil() && !state.Name.Eq(xname) {
		return NewInvalidLink(head, "wrong name for team")
	}
	state.Name = xname
	return nil
}

// readPerTeamKey reads a PerTeamKey section, if it exists, out of the given unpacked chainlink.
func readPerTeamKey(m libkb.MetaContext, link *ChainLinkUnpacked) (ret *keybase1.PerTeamKey, err error) {

	if link.inner == nil || link.inner.Body.Team == nil || link.inner.Body.Team.PerTeamKey == nil {
		return nil, nil
	}
	ptk := link.inner.Body.Team.PerTeamKey
	return &keybase1.PerTeamKey{
		Gen:    ptk.Generation,
		Seqno:  link.Seqno(),
		SigKID: ptk.SigKID,
		EncKID: ptk.EncKID,
	}, nil
}

// putLinks takes the links we just downloaded from the server, and stores them to the state.
// It also fills in unstubbed fields for those links that have come back with payloads that
// were previously stubbed. There are several error cases that can come up, when reading down
// or up pointers from the reply.
func (f *FastTeamChainLoader) putLinks(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData, newLinks []*ChainLinkUnpacked) (err error) {
	if len(newLinks) == 0 {
		return nil
	}

	for _, link := range newLinks {
		existing, ok := state.Chain.LinkIDs[link.Seqno()]
		linkID := link.LinkID().Export()
		if ok {
			// NOTE! This is a crucial check, since we might have checked prev's on this link
			// in a previous run on the chain. We have to make sure an unstubbed link is
			// consistent with that previous check. See checkPrevs for when we skip
			// checking prevs in such a case, and need to check here for linkID equality.
			if !linkID.Eq(existing) {
				return NewInvalidLink(link, "list doesn't match previously cached link")
			}
		} else {
			state.Chain.LinkIDs[link.Seqno()] = linkID
		}
		dp, err := readDownPointer(m, link)
		if err != nil {
			return err
		}
		if dp != nil {
			state.Chain.DownPointers[link.Seqno()] = *dp
		}
		up, err := readUpPointer(m, arg, link)
		if err != nil {
			return err
		}
		if up != nil && (state.Chain.LastUpPointer == nil || state.Chain.LastUpPointer.OurSeqno < up.OurSeqno) {
			state.Chain.LastUpPointer = up
		}
		ptk, err := readPerTeamKey(m, link)
		if err != nil {
			return err
		}
		if ptk != nil {
			state.Chain.PerTeamKeys[ptk.Gen] = *ptk
		}
		merkleRoot, err := readMerkleRoot(m, link)
		if err != nil {
			return err
		}
		if merkleRoot != nil {
			state.Chain.MerkleInfo[link.Seqno()] = *merkleRoot
		}
	}
	newLast := newLinks[len(newLinks)-1]
	if state.Chain.Last == nil || state.Chain.Last.Seqno < newLast.Seqno() {
		tmp := newLast.LinkTriple()
		state.Chain.Last = &tmp
	}
	return nil
}

// putRKMs stores the new reader key masks loaded from the server to the state structure.
func (f *FastTeamChainLoader) putRKMs(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData, rkms []keybase1.ReaderKeyMask) (err error) {
	for _, rkm := range rkms {
		if _, ok := state.ReaderKeyMasks[rkm.Application]; !ok {
			state.ReaderKeyMasks[rkm.Application] = make(map[keybase1.PerTeamKeyGeneration]keybase1.MaskB64)
		}
		state.ReaderKeyMasks[rkm.Application][rkm.Generation] = rkm.Mask
	}
	return nil
}

// putSeeds stores the crypto seeds to the PeterTeamKeySeedsUnverified slot of the state. It returns
// the last n seeds, counting backwards. We exploit this fact to infer the seed generations from their
// order.
func (f *FastTeamChainLoader) putSeeds(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData, latestKeyGen keybase1.PerTeamKeyGeneration, seeds []keybase1.PerTeamKeySeed) (err error) {
	for i, seed := range seeds {
		state.PerTeamKeySeedsUnverified[latestKeyGen-keybase1.PerTeamKeyGeneration(len(seeds)-i-1)] = seed
	}

	// We might have gotten back 0 seeds from the server, so don't overwrite a valid LatestKeyGeneration
	// with 0 in that case.
	if latestKeyGen > state.LatestKeyGeneration {
		state.LatestKeyGeneration = latestKeyGen
	}
	return nil
}

func (f *FastTeamChainLoader) putSeedChecks(m libkb.MetaContext, state *keybase1.FastTeamData) (err error) {
	latestChainGen := keybase1.PerTeamKeyGeneration(len(state.PerTeamKeySeedsUnverified))
	if state.SeedChecks == nil {
		state.SeedChecks = make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamSeedCheck)
	}
	return computeSeedChecks(
		m.Ctx(),
		state.ID(),
		latestChainGen,
		func(g keybase1.PerTeamKeyGeneration) (check *keybase1.PerTeamSeedCheck, seed keybase1.PerTeamKeySeed, err error) {
			seed, ok := state.PerTeamKeySeedsUnverified[g]
			if !ok {
				return nil, keybase1.PerTeamKeySeed{}, fmt.Errorf("unexpected nil PerTeamKeySeedsUnverified at %d", g)
			}
			tmp, ok := state.SeedChecks[g]
			if ok {
				check = &tmp
			}
			return check, seed, nil
		},
		func(g keybase1.PerTeamKeyGeneration, check keybase1.PerTeamSeedCheck) {
			state.SeedChecks[g] = check
		},
	)
}

func setCachedAtToNow(m libkb.MetaContext, state *keybase1.FastTeamData) {
	state.CachedAt = keybase1.ToTime(m.G().Clock().Now())
}

func (f *FastTeamChainLoader) putMetadata(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData) error {
	setCachedAtToNow(m, state)
	if arg.NeedLatestKey {
		state.LoadedLatest = true
	}
	return nil
}

// mutateState takes the groceries fetched from the server and applies them to our current state.
func (f *FastTeamChainLoader) mutateState(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData, groceries *groceries) (err error) {

	err = f.putName(m, arg, state, groceries.newLinks)
	if err != nil {
		return err
	}
	err = f.putLinks(m, arg, state, groceries.newLinks)
	if err != nil {
		return err
	}
	err = f.putRKMs(m, arg, state, groceries.rkms)
	if err != nil {
		return err
	}
	err = f.putSeeds(m, arg, state, groceries.latestKeyGen, groceries.seeds)
	if err != nil {
		return err
	}
	err = f.putSeedChecks(m, state)
	if err != nil {
		return err
	}
	err = f.putMetadata(m, arg, state)
	if err != nil {
		return err
	}
	return nil
}

// makeState does a clone on a non-nil state, or makes a new state if nil.
func makeState(arg fastLoadArg, s *keybase1.FastTeamData) *keybase1.FastTeamData {
	if s != nil {
		tmp := s.DeepCopy()
		return &tmp
	}
	return &keybase1.FastTeamData{
		Subversion:                1,
		PerTeamKeySeedsUnverified: make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeed),
		SeedChecks:                make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamSeedCheck),
		ReaderKeyMasks:            make(map[keybase1.TeamApplication](map[keybase1.PerTeamKeyGeneration]keybase1.MaskB64)),
		Chain: keybase1.FastTeamSigChainState{
			ID:                      arg.ID,
			Public:                  arg.Public,
			PerTeamKeys:             make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKey),
			PerTeamKeySeedsVerified: make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeed),
			DownPointers:            make(map[keybase1.Seqno]keybase1.DownPointer),
			LinkIDs:                 make(map[keybase1.Seqno]keybase1.LinkID),
			MerkleInfo:              make(map[keybase1.Seqno]keybase1.MerkleRootV2),
		},
	}
}

func (f *FastTeamChainLoader) hiddenPackage(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData) (hp *hidden.LoaderPackage, err error) {
	defer m.Trace(fmt.Sprintf("FastTeamChainLoader#hiddenPackage(%+v)", arg), func() error { return err })()
	return hidden.NewLoaderPackage(m, arg.ID,
		func() (encKID keybase1.KID, gen keybase1.PerTeamKeyGeneration, role keybase1.TeamRole, err error) {
			// Always return TeamRole_NONE since ftl does not have access to
			// member roles. The hidden chain uses the role to skip checks bot
			// members are not able to perform. Bot members should never FTL,
			// however since they don't have key access.
			if state == nil || len(state.Chain.PerTeamKeys) == 0 {
				return encKID, gen, keybase1.TeamRole_NONE, nil
			}
			var ptk keybase1.PerTeamKey
			for _, tmp := range state.Chain.PerTeamKeys {
				ptk = tmp
				break
			}
			return ptk.EncKID, ptk.Gen, keybase1.TeamRole_NONE, nil
		})
}

func (f *FastTeamChainLoader) consumeRatchets(m libkb.MetaContext, newLinks []*ChainLinkUnpacked, hp *hidden.LoaderPackage) (err error) {
	for _, link := range newLinks {
		if err := consumeRatchets(m, hp, link); err != nil {
			return err
		}
	}
	return nil
}

func (f *FastTeamChainLoader) processHidden(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData, groceries *groceries, hp *hidden.LoaderPackage) (err error) {

	err = f.consumeRatchets(m, groceries.newLinks, hp)
	if err != nil {
		return err
	}

	err = hp.Update(m, groceries.newHiddenLinks)
	if err != nil {
		return err
	}
	err = hp.CheckUpdatesAgainstSeeds(m, func(g keybase1.PerTeamKeyGeneration) *keybase1.PerTeamSeedCheck {
		chk, ok := state.SeedChecks[g]
		if !ok {
			return nil
		}
		return &chk
	})
	if err != nil {
		return err
	}
	err = hp.CheckParentPointersOnFastLoad(m, state)
	if err != nil {
		return err
	}
	err = hp.CheckChainHasMinLength(m, groceries.expMaxHiddenSeqno)
	if err != nil {
		return err
	}
	err = hp.Commit(m)
	if err != nil {
		return err
	}
	return nil
}

// refresh the team's state, but loading with the server. It will download new stubbed chainlinks,
// fill in unstubbed chainlinks, make sure that prev pointers match, make sure that the merkle
// tree agrees with the chain tail, and then run the audit mechanism. If the state is already
// fresh, we will return (nil, nil) and short-circuit.
func (f *FastTeamChainLoader) refresh(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData, shoppingList shoppingList, hp *hidden.LoaderPackage) (res *keybase1.FastTeamData, err error) {

	defer m.Trace(fmt.Sprintf("FastTeamChainLoader#refresh(%+v)", arg), func() error { return err })()

	groceries, err := f.loadFromServerWithRetries(m, arg, state, shoppingList, hp)
	if err != nil {
		return nil, err
	}

	if groceries == nil {
		m.Debug("FastTeamChainLoader#refresh: our state was fresh according to the Merkle tree")
		return nil, nil
	}

	// Either makes a new state, or deepcopies the existing state, so that in the case
	// of an error, we haven't corrupted what's in cache. Thus, from here on out,
	// we are playing with our own (unshared) copy of the state.
	state = makeState(arg, state)

	// check that all chain links sent down form a valid hash chain, and point
	// to what we already in had in cache.
	err = f.checkPrevs(m, arg, state.Chain.Last, groceries.newLinks)
	if err != nil {
		return nil, err
	}

	// check that the server stubbed properly.
	err = f.checkStubs(m, shoppingList, groceries.newLinks, arg.readSubteamID.IsNil() /* canReadTeam */)
	if err != nil {
		return nil, err
	}

	err = f.mutateState(m, arg, state, groceries)
	if err != nil {
		return nil, err
	}

	err = f.processHidden(m, arg, state, groceries, hp)
	if err != nil {
		return nil, err
	}

	// peform a probabilistic audit on the new links
	err = f.audit(m, arg, state)
	if err != nil {
		return nil, err
	}

	return state, nil
}

// updateCache puts the new version of the state into the cache on the team's ID.
func (f *FastTeamChainLoader) updateCache(m libkb.MetaContext, state *keybase1.FastTeamData) {
	f.storage.Put(m, state)
}

func (f *FastTeamChainLoader) upgradeStoredState(mctx libkb.MetaContext, state *keybase1.FastTeamData) (changed bool, err error) {
	if state == nil {
		return false, nil
	}

	changed = false
	if state.Subversion == 0 {
		err = f.putSeedChecks(mctx, state)
		if err != nil {
			mctx.Debug("failed in upgrade of subversion 0->1: %s", err)
			return false, err
		}
		mctx.Debug("Upgrade to subversion 1")
		state.Subversion = 1
		changed = true
	}

	return changed, nil
}

// loadLocked is the inner loop for loading team. Should be called when holding the lock
// this teamID.
func (f *FastTeamChainLoader) loadLocked(m libkb.MetaContext, arg fastLoadArg) (res *fastLoadRes, err error) {

	frozenState, frozen, tombstoned := f.findStateInCache(m, arg.ID)
	var state *keybase1.FastTeamData
	var hp *hidden.LoaderPackage
	if tombstoned {
		return nil, NewTeamTombstonedError()
	}
	if !frozen {
		state = frozenState
	}

	hp, err = f.hiddenPackage(m, arg, state)
	if err != nil {
		return nil, err
	}

	var shoppingList shoppingList
	if state != nil {
		combinedData := newFTLCombinedData(state, hp.ChainData())
		f.computeWithPreviousState(m, &shoppingList, arg, combinedData)
		if shoppingList.isEmpty() {
			return f.toResult(m, arg, combinedData)
		}
	} else {
		shoppingList.computeFreshLoad(m, arg)
	}
	shoppingList.addHiddenLow(hp)

	m.Debug("FastTeamChainLoader#loadLocked: computed shopping list: %+v", shoppingList)

	var newState *keybase1.FastTeamData
	newState, err = f.refresh(m, arg, state, shoppingList, hp)
	if err != nil {
		return nil, err
	}

	// If newState == nil, that means that no updates were required, and the old state
	// is fine, we just need to update the cachedAt time. If newState is non-nil,
	// then we use if for our state going forward.
	if newState == nil {
		setCachedAtToNow(m, state)
	} else {
		state = newState
	}
	// Always update the cache, even if we're just bumping the cachedAt time.
	f.updateCache(m, state)

	if frozen && frozenState != nil {
		frozenLast := frozenState.Chain.Last
		linkID := state.Chain.LinkIDs[frozenLast.Seqno]
		if !linkID.Eq(frozenLast.LinkID) {
			return nil, fmt.Errorf("FastTeamChainLoader#loadLocked: got wrong sigchain link ID for seqno %d: expected %v from previous cache entry (frozen=%t); got %v in new chain", frozenLast.Seqno, frozenLast.LinkID, frozen, linkID)
		}
	}

	return f.toResult(m, arg, newFTLCombinedData(state, hp.ChainData()))
}

// OnLogout is called when the user logs out, which purges the LRU.
func (f *FastTeamChainLoader) OnLogout(mctx libkb.MetaContext) error {
	f.storage.ClearMem()
	f.featureFlagGate.Clear()
	return nil
}

// OnDbNuke is called when the disk cache is cleared, which purges the LRU.
func (f *FastTeamChainLoader) OnDbNuke(mctx libkb.MetaContext) error {
	f.storage.ClearMem()
	f.featureFlagGate.Clear()
	return nil
}

func (f *FastTeamChainLoader) HintLatestSeqno(m libkb.MetaContext, id keybase1.TeamID, seqno keybase1.Seqno) (err error) {
	m = ftlLogTag(m)

	defer m.Trace(fmt.Sprintf("FastTeamChainLoader#HintLatestSeqno(%v->%d)", id, seqno), func() error { return err })()

	// Single-flight lock by team ID.
	lock := f.locktab.AcquireOnName(m.Ctx(), m.G(), id.String())
	defer lock.Release(m.Ctx())

	if state, frozen, tombstoned := f.findStateInCache(m, id); state != nil && !frozen && !tombstoned {
		m.Debug("Found state in cache; updating")
		state.LatestSeqnoHint = seqno
		f.updateCache(m, state)
	}

	return nil
}

func (f *FastTeamChainLoader) ForceRepollUntil(m libkb.MetaContext, dtime gregor.TimeOrOffset) error {
	m.Debug("FastTeamChainLoader#ForceRepollUntil(%+v)", dtime)
	f.forceRepollMutex.Lock()
	defer f.forceRepollMutex.Unlock()
	f.forceRepollUntil = dtime
	return nil
}

func (f *FastTeamChainLoader) InForceRepollMode(m libkb.MetaContext) bool {
	f.forceRepollMutex.Lock()
	defer f.forceRepollMutex.Unlock()
	if f.forceRepollUntil == nil {
		return false
	}
	if !f.forceRepollUntil.Before(m.G().Clock().Now()) {
		m.Debug("FastTeamChainLoader#InForceRepollMode: returning true")
		return true
	}
	f.forceRepollUntil = nil
	return false
}

func newFrozenFastChain(chain *keybase1.FastTeamSigChainState) keybase1.FastTeamSigChainState {
	return keybase1.FastTeamSigChainState{
		ID:     chain.ID,
		Public: chain.Public,
		Last:   chain.Last,
	}
}

func (f *FastTeamChainLoader) Freeze(mctx libkb.MetaContext, teamID keybase1.TeamID) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("FastTeamChainLoader#Freeze(%s)", teamID), func() error { return err })()

	// Single-flight lock by team ID.
	lock := f.locktab.AcquireOnName(mctx.Ctx(), mctx.G(), teamID.String())
	defer lock.Release(mctx.Ctx())

	td, frozen, tombstoned := f.storage.Get(mctx, teamID, teamID.IsPublic())
	if frozen || td == nil {
		return nil
	}
	newTD := &keybase1.FastTeamData{
		Frozen:     true,
		Tombstoned: tombstoned,
		Chain:      newFrozenFastChain(&td.Chain),
	}
	f.storage.Put(mctx, newTD)
	return nil
}

func (f *FastTeamChainLoader) Tombstone(mctx libkb.MetaContext, teamID keybase1.TeamID) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("FastTeamChainLoader#Tombstone(%s)", teamID), func() error { return err })()

	// Single-flight lock by team ID.
	lock := f.locktab.AcquireOnName(mctx.Ctx(), mctx.G(), teamID.String())
	defer lock.Release(mctx.Ctx())

	td, frozen, tombstoned := f.storage.Get(mctx, teamID, teamID.IsPublic())
	if tombstoned || td == nil {
		return nil
	}
	newTD := &keybase1.FastTeamData{
		Frozen:     frozen,
		Tombstoned: true,
		Chain:      newFrozenFastChain(&td.Chain),
	}
	f.storage.Put(mctx, newTD)
	return nil
}
