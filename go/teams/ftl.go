package teams

import (
	"fmt"
	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"strings"
	"sync"
	"time"
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
	locktab libkb.LockTable

	// Hold onto FastTeamLoad by-products as long as we have room
	// We don't store them to disk (as we do slow Load objects).
	// LRU of TeamID -> keybase1.FastTeamData. The LRU is protected
	// by a mutex, because it's swapped out on logout.
	lruMutex sync.Mutex
	lru      *lru.Cache
}

const FTLVersion = 1

// NewFastLoader makes a new fast loader and initializes it.
func NewFastTeamLoader(g *libkb.GlobalContext) *FastTeamChainLoader {
	ret := &FastTeamChainLoader{
		world: NewLoaderContextFromG(g),
	}
	ret.newLRU()
	return ret
}

// NewFastTeamLoaderAndInstall creates a new loader and installs it into G.
func NewFastTeamLoaderAndInstall(g *libkb.GlobalContext) *FastTeamChainLoader {
	l := NewFastTeamLoader(g)
	g.SetFastTeamLoader(l)
	return l
}

var _ libkb.FastTeamLoader = (*FastTeamChainLoader)(nil)

// Load fast-loads the given team. Provide some hints as to how to load it. You can specify an application
// and key generations needed, if you are entering chat. Those links will be returned unstubbed
// from the server, and then the keys can be output in the result.
func (f *FastTeamChainLoader) Load(m libkb.MetaContext, arg keybase1.FastTeamLoadArg) (res keybase1.FastTeamLoadRes, err error) {
	m = m.WithLogTag("FTL")
	defer m.CTrace(fmt.Sprintf("FastTeamChainLoader#Load(%+v)", arg), func() error { return err })()

	if arg.ID.IsPublic() != arg.Public {
		return res, NewBadPublicError(arg.ID, arg.Public)
	}

	flr, err := f.load(m, fastLoadArg{FastTeamLoadArg: arg})
	if err != nil {
		return res, err
	}

	res.ApplicationKeys = flr.applicationKeys
	res.Name, err = f.verifyTeamNameViaParentLoad(m, arg.ID, arg.Public, flr.unverifiedName, flr.upPointer, arg.ID)
	if err != nil {
		return res, err
	}

	return res, nil
}

// verifyTeamNameViaParentLoad takes a team ID, and a pointer to a parent team's sigchain, and computes
// the full resolved team name. If the pointer is null, we'll assume this is a root team and do the
// verification via hash-comparison.
func (f *FastTeamChainLoader) verifyTeamNameViaParentLoad(m libkb.MetaContext, id keybase1.TeamID, isPublic bool, unverifiedName keybase1.TeamName, parent *keybase1.UpPointer, bottomSubteam keybase1.TeamID) (res keybase1.TeamName, err error) {

	defer m.CTrace(fmt.Sprintf("FastTeamChainLoader#verifyTeamNameViaParentLoad(%s,%s)", id, unverifiedName), func() error { return err })()

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
			ID:     parent.ParentID,
			Public: isPublic,
		},
		downPointersNeeded: []keybase1.Seqno{parent.ParentSeqno},
		needFreshState:     true,
		readSubteamID:      bottomSubteam,
	})
	if err != nil {
		return res, err
	}
	downPointer, ok := parentRes.downPointers[parent.ParentSeqno]
	if !ok {
		return res, NewBadNameError("down pointer not found in parent")
	}
	suffix := downPointer.NameComponent

	parentName, err := f.verifyTeamNameViaParentLoad(m, parent.ParentID, isPublic, parentRes.unverifiedName, parentRes.upPointer, bottomSubteam)
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
	downPointersNeeded []keybase1.Seqno
	readSubteamID      keybase1.TeamID
	needFreshState     bool
}

// NeedFresh returns true if the load argument implies that we need a refreshment
// of the local cache for this team.
func (a fastLoadArg) NeedFresh() bool {
	return a.needFreshState || a.NeedLatestKey
}

// load acquires a lock by team ID, and the runs loadLocked.
func (f *FastTeamChainLoader) load(m libkb.MetaContext, arg fastLoadArg) (res *fastLoadRes, err error) {

	defer m.CTrace(fmt.Sprintf("FastTeamChainLoader#load(%+v)", arg), func() error { return err })()

	// Single-flight lock by team ID.
	lock := f.locktab.AcquireOnName(m.Ctx(), m.G(), arg.ID.String())
	defer lock.Release(m.Ctx())

	return f.loadLocked(m, arg)
}

// dervieSeedAtGeneration either goes to cache or rederives the PTK private seed
// for the given generation gen.
func (f *FastTeamChainLoader) deriveSeedAtGeneration(m libkb.MetaContext, gen keybase1.PerTeamKeyGeneration, state *keybase1.FastTeamData) (seed keybase1.PerTeamKeySeed, err error) {

	seed, ok := state.Chain.PerTeamKeySeedsVerified[gen]
	if ok {
		return seed, nil
	}
	var tmp keybase1.PerTeamKeySeed
	tmp, ok = state.PerTeamKeySeedsUnverified[gen]
	if !ok {
		return seed, NewFastLoadError(fmt.Sprintf("no unverified key seed found at generation %d", gen))
	}

	ptkChain, ok := state.Chain.PerTeamKeys[gen]
	if !ok {
		return seed, NewFastLoadError(fmt.Sprintf("no per team key public halves at generation %d", gen))
	}

	km, err := NewTeamKeyManagerWithSecret(tmp, gen)
	if err != nil {
		return seed, err
	}

	sigKey, err := km.SigningKey()
	if err != nil {
		return seed, err
	}

	if !ptkChain.SigKID.SecureEqual(sigKey.GetKID()) {
		m.CDebugf("sig KID gen:%v (local) %v != %v (chain)", gen, sigKey.GetKID(), ptkChain.SigKID)
		return seed, NewFastLoadError(fmt.Sprintf("wrong team key (sig) found at generation %v", gen))
	}

	encKey, err := km.EncryptionKey()
	if err != nil {
		return seed, err
	}

	if !ptkChain.EncKID.SecureEqual(encKey.GetKID()) {
		m.CDebugf("enc KID gen:%v (local) %v != %v (chain)", gen, encKey.GetKID(), ptkChain.EncKID)
		return seed, NewFastLoadError(fmt.Sprintf("wrong team key (enc) found at generation %v", gen))
	}

	// write back to cache
	seed = tmp
	state.Chain.PerTeamKeySeedsVerified[gen] = seed
	return seed, err
}

// deriveKeyForApplicationAtGeneration pulls from cache or generates the PTK for the
// given application at the given generation.
func (f *FastTeamChainLoader) deriveKeyForApplicationAtGeneration(m libkb.MetaContext, app keybase1.TeamApplication, gen keybase1.PerTeamKeyGeneration, state *keybase1.FastTeamData) (key keybase1.TeamApplicationKey, err error) {

	seed, err := f.deriveSeedAtGeneration(m, gen, state)
	if err != nil {
		return key, err
	}

	var mask *keybase1.MaskB64
	if m := state.ReaderKeyMasks[app]; m != nil {
		tmp, ok := m[gen]
		if ok {
			mask = &tmp
		}
	}
	if mask == nil {
		return key, NewFastLoadError(fmt.Sprintf("Could not get reader key mask for <%d,%d>", app, gen))
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
func (f *FastTeamChainLoader) deriveKeysForApplication(m libkb.MetaContext, app keybase1.TeamApplication, arg fastLoadArg, state *keybase1.FastTeamData) (keys []keybase1.TeamApplicationKey, err error) {

	var didLatest bool
	doKey := func(gen keybase1.PerTeamKeyGeneration) error {
		var key keybase1.TeamApplicationKey
		key, err = f.deriveKeyForApplicationAtGeneration(m, app, gen, state)
		if err != nil {
			return err
		}
		keys = append(keys, key)
		if gen == state.LatestKeyGeneration {
			didLatest = true
		}
		return nil
	}

	for _, gen := range arg.KeyGenerationsNeeded {
		if err = doKey(gen); err != nil {
			return nil, err
		}
	}
	if !didLatest && arg.NeedLatestKey {
		if err = doKey(state.LatestKeyGeneration); err != nil {
			return nil, err
		}
	}
	return keys, nil
}

// deriveKeys pulls from cache or generates PTKs for an set of (application X generations)
// pairs, for all in the cartesian product.
func (f *FastTeamChainLoader) deriveKeys(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData) (keys []keybase1.TeamApplicationKey, err error) {
	for _, app := range arg.Applications {
		var tmp []keybase1.TeamApplicationKey
		tmp, err = f.deriveKeysForApplication(m, app, arg, state)
		if err != nil {
			return nil, err
		}
		keys = append(keys, tmp...)
	}
	return keys, nil
}

// toResult turns the current fast state into a fastLoadRes.
func (f *FastTeamChainLoader) toResult(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData) (res *fastLoadRes, err error) {
	res = &fastLoadRes{
		unverifiedName: state.Name,
		downPointers:   state.Chain.DownPointers,
		upPointer:      state.Chain.LastUpPointer,
	}
	res.applicationKeys, err = f.deriveKeys(m, arg, state)
	if err != nil {
		return nil, err
	}
	return res, nil
}

// findState in cache finds the team ID's state in an in-memory cache.
func (f *FastTeamChainLoader) findStateInCache(m libkb.MetaContext, arg fastLoadArg, lru *lru.Cache) (state *keybase1.FastTeamData) {
	tmp, found := lru.Get(arg.ID)
	if !found {
		return nil
	}
	state, ok := tmp.(*keybase1.FastTeamData)
	if !ok {
		m.CErrorf("Bad type assertion in FastTeamChainLoader#checkCachine")
		return nil
	}
	return state
}

// stateHasKeySeed returns true/false if the state has the seed material for th egiven
// generation. Either the fully verified PTK seed, or the public portion and
// unverified PTK seed.
func (f *FastTeamChainLoader) stateHasKeySeed(m libkb.MetaContext, gen keybase1.PerTeamKeyGeneration, state *keybase1.FastTeamData) bool {
	_, foundVerified := state.Chain.PerTeamKeySeedsVerified[gen]
	if foundVerified {
		return true
	}
	_, foundUnverifiedSeed := state.PerTeamKeySeedsUnverified[gen]
	if !foundUnverifiedSeed {
		return false
	}
	_, foundPerTeamKey := state.Chain.PerTeamKeys[gen]
	if !foundPerTeamKey {
		return false
	}
	return true
}

// stateHasKeys checks to see if the given state has the keys specified in the shopping list. If not, it will
// modify the shopping list and return false. If yes, it will leave the shopping list unchanged and return
// true.
func stateHasKeys(m libkb.MetaContext, shoppingList *shoppingList, arg fastLoadArg, state *keybase1.FastTeamData) (ret bool) {
	apps := make(map[keybase1.TeamApplication]struct{})
	gens := make(map[keybase1.PerTeamKeyGeneration]struct{})

	ret = true

	if arg.NeedLatestKey {
		for _, app := range arg.Applications {
			apps[app] = struct{}{}
		}
		ret = false
		shoppingList.needRefresh = true
	}

	for _, app := range arg.Applications {
		for _, gen := range arg.KeyGenerationsNeeded {
			if state.ReaderKeyMasks[app] == nil || state.ReaderKeyMasks[app][gen] == nil {
				gens[gen] = struct{}{}
				apps[app] = struct{}{}
				m.CDebugf("state doesn't have mask for <%d,%d>", app, gen)
				ret = false
			}
		}
	}

	for app := range apps {
		shoppingList.applications = append(shoppingList.applications, app)
	}
	for gen := range gens {
		shoppingList.generations = append(shoppingList.generations, gen)
	}
	return ret
}

// stateHasDownPointers checks to see if the given state has the down pointers specified in the shopping list.
// If not, it will change the shopping list to have the down pointers and return false. If yes, it will
// leave the shopping list unchanged and return true.
func stateHasDownPointers(m libkb.MetaContext, shoppingList *shoppingList, arg fastLoadArg, state *keybase1.FastTeamData) (ret bool) {
	ret = true

	for _, seqno := range arg.downPointersNeeded {
		if _, ok := state.Chain.DownPointers[seqno]; !ok {
			m.CDebugf("Down pointer at seqno=%d wasn't found", seqno)
			shoppingList.addDownPointer(seqno)
			ret = false
		}
	}
	return ret
}

// shoppingList is a list of what we need from the server.
type shoppingList struct {
	needRefresh bool

	// links *and* PTKs newer than the given seqno. And RKMs for
	// the given apps.
	linksSince   keybase1.Seqno
	downPointers []keybase1.Seqno

	// The applications we care about.
	applications []keybase1.TeamApplication

	// The generations we care about. We'll always get back the most recent RKMs
	// if we send a needRefresh.
	generations []keybase1.PerTeamKeyGeneration
}

// groceries are what we get back from the server.
type groceries struct {
	newLinks     []*chainLinkUnpacked
	rkms         []keybase1.ReaderKeyMask
	latestKeyGen keybase1.PerTeamKeyGeneration
	seeds        []keybase1.PerTeamKeySeed
}

// isEmpty returns true if our shopping list is empty. In this case, we have no need to go to the
// server (store), and can just return with what's in our cache.
func (s shoppingList) isEmpty() bool {
	return !s.needRefresh && len(s.generations) == 0 && len(s.downPointers) == 0
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
func (s *shoppingList) computeWithPreviousState(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData) {
	cachedAt := state.CachedAt.Time()
	s.linksSince = state.Chain.Last.Seqno
	if arg.NeedFresh() && m.G().Clock().Now().Sub(cachedAt) > time.Hour {
		m.CDebugf("cached value is more than an hour old (cached at %s)", cachedAt)
		s.needRefresh = true
	}
	if arg.NeedFresh() && state.LatestSeqnoHint > state.Chain.Last.Seqno {
		m.CDebugf("cached value is stale: seqno %d > %d", state.LatestSeqnoHint, state.Chain.Last.Seqno)
		s.needRefresh = true
	}
	if !stateHasKeys(m, s, arg, state) {
		m.CDebugf("state was missing needed encryption keys, or we need the freshest")
	}
	if !stateHasDownPointers(m, s, arg, state) {
		m.CDebugf("state was missing unstubbed args")
	}
}

// computeFreshLoad computes a shopping list from a fresh load of the state.
func (s *shoppingList) computeFreshLoad(m libkb.MetaContext, arg fastLoadArg) {
	s.needRefresh = true
	s.applications = append([]keybase1.TeamApplication{}, arg.Applications...)
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
func (a fastLoadArg) toHTTPArgs(s shoppingList) libkb.HTTPArgs {
	ret := libkb.HTTPArgs{
		"id":                  libkb.S{Val: a.ID.String()},
		"public":              libkb.B{Val: a.Public},
		"ftl":                 libkb.B{Val: true},
		"ftl_low":             libkb.I{Val: int(s.linksSince)},
		"ftl_seqnos":          libkb.S{Val: seqnosToString(s.downPointers)},
		"ftl_key_generations": libkb.S{Val: generationsToString(s.generations)},
		"ftl_version":         libkb.I{Val: FTLVersion},
	}
	if len(s.applications) > 0 {
		ret["ftl_include_applications"] = libkb.S{Val: applicationsToString(s.applications)}
		ret["ftl_n_newest_key_generations"] = libkb.I{Val: int(3)}
	}
	if !a.readSubteamID.IsNil() {
		ret["read_subteam_id"] = libkb.S{Val: a.readSubteamID.String()}
	}
	return ret
}

// loadFromServerWithRetries loads the leaf in the merkle tree and then fetches from team/get.json the links
// needed for the team chain. There is a race possible, when a link is added between the two. In that
// case, refetch in a loop until we match up. It will retry in the case of GreenLinkErrors.
func (f *FastTeamChainLoader) loadFromServerWithRetries(m libkb.MetaContext, arg fastLoadArg, shoppingList shoppingList) (groceries *groceries, err error) {

	defer m.CTrace(fmt.Sprintf("FastTeamChainLoader#loadFromServerWithRetries(%s,%v)", arg.ID, arg.Public), func() error { return err })()

	const nRetries = 3
	for i := 0; i < nRetries; i++ {
		groceries, err = f.loadFromServerOnce(m, arg, shoppingList)
		switch err.(type) {
		case nil:
			return groceries, nil
		case GreenLinkError:
			m.CDebugf("FastTeamChainLoader retrying after green link")
			continue
		default:
			return nil, err
		}
	}
	return nil, err
}

// makeHTTPRequest hits the HTTP GET endpoint for the team data.
func (f *FastTeamChainLoader) makeHTTPRequest(m libkb.MetaContext, args libkb.HTTPArgs, isPublic bool) (t rawTeam, err error) {
	apiArg := libkb.NewAPIArgWithMetaContext(m, "team/get")
	apiArg.Args = args
	if isPublic {
		apiArg.SessionType = libkb.APISessionTypeOPTIONAL
	} else {
		apiArg.SessionType = libkb.APISessionTypeREQUIRED
	}
	err = m.G().API.GetDecode(apiArg, &t)
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
func (f *FastTeamChainLoader) loadFromServerOnce(m libkb.MetaContext, arg fastLoadArg, shoppingList shoppingList) (ret *groceries, err error) {

	defer m.CTrace("FastTeamChainLoader#loadFromServerOnce", func() error { return err })()

	var lastSeqno keybase1.Seqno
	var lastLinkID keybase1.LinkID
	var teamUpdate rawTeam
	var links []*chainLinkUnpacked
	var lastSecretGen keybase1.PerTeamKeyGeneration
	var seeds []keybase1.PerTeamKeySeed

	lastSeqno, lastLinkID, err = f.world.merkleLookup(m.Ctx(), arg.ID, arg.Public)
	if err != nil {
		return nil, err
	}
	teamUpdate, err = f.makeHTTPRequest(m, arg.toHTTPArgs(shoppingList), arg.Public)
	if err != nil {
		return nil, err
	}
	if !teamUpdate.ID.Eq(arg.ID) {
		return nil, NewFastLoadError("server returned wrong id: %v != %v", teamUpdate.ID, arg.ID)
	}
	links, err = teamUpdate.unpackLinks(m.Ctx())
	if err != nil {
		return nil, err
	}

	for _, link := range links {
		if link.Seqno() > lastSeqno {
			m.CDebugf("TeamLoader found green link seqno:%v", link.Seqno())
			return nil, NewGreenLinkError(link.Seqno())
		}
		if link.Seqno() == lastSeqno && !lastLinkID.Eq(link.LinkID().Export()) {
			m.CDebugf("Merkle tail mismatch at link %d: %v != %v", lastSeqno, lastLinkID, link.LinkID().Export())
			return nil, NewInvalidLink(link, "last link did not match merkle tree")
		}
	}

	if teamUpdate.Box != nil {
		lastSecretGen, seeds, err = unboxPerTeamSecrets(m, f.world, teamUpdate.Box, teamUpdate.Prevs)
		if err != nil {
			return nil, err
		}
	}

	m.CDebugf("#loadFromServerOnce: got back %d new links", len(links))

	return &groceries{
		newLinks:     links,
		latestKeyGen: lastSecretGen,
		rkms:         teamUpdate.ReaderKeyMasks,
		seeds:        seeds,
	}, nil
}

// checkStubs makes sure that new links sent down from the server have the right stubbing/unstubbing
// pattern. The rules are: the most recent "up pointer" should be unstubbed. The first link should be
// unstubbed. The last key rotation should be unstubbed (though we can't really check this now).
// And any links we ask for should be unstubbed too.
func (f *FastTeamChainLoader) checkStubs(m libkb.MetaContext, shoppingList shoppingList, newLinks []*chainLinkUnpacked) (err error) {

	if len(newLinks) == 0 {
		return nil
	}

	isUpPointer := func(t libkb.SigchainV2Type) bool {
		return (t == libkb.SigchainV2TypeTeamRenameUpPointer) || (t == libkb.SigchainV2TypeTeamDeleteUpPointer)
	}

	isKeyRotation := func(link *chainLinkUnpacked) bool {
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

	if newLinks[0].isStubbed() {
		return NewInvalidLink(newLinks[0], "expected first link to be unstubbed")
	}

	return nil
}

// checkPrevs checks the previous pointers on the new links that came down from the server. It
// only checks prevs for links that are newer than the last link gotten in this chain.
// We assume the rest are expanding hashes for links we've previously downloaded.
func (f *FastTeamChainLoader) checkPrevs(m libkb.MetaContext, last *keybase1.LinkTriple, newLinks []*chainLinkUnpacked) (err error) {
	if len(newLinks) == 0 {
		return nil
	}

	var prev keybase1.LinkTriple
	if last != nil {
		prev = *last
	}

	cmpHash := func(prev keybase1.LinkTriple, link *chainLinkUnpacked) (err error) {

		// not ideal to have to export here, but it simplifies the code.
		prevex := link.Prev().Export()

		if prev.LinkID.IsNil() && prevex.IsNil() {
			return nil
		}
		if prev.LinkID.IsNil() || prevex.IsNil() {
			m.CDebugf("Bad prev nil/non-nil pointer check at seqno %d: (prev=%v vs curr=%v)", link.Seqno(), prev.LinkID.IsNil(), prevex.IsNil())
			return NewInvalidLink(link, "bad nil/non-nil prev pointer comparison")
		}
		if !prev.LinkID.Eq(prevex) {
			m.CDebugf("Bad prev comparison at seqno %d: %s != %s", prev.LinkID, prevex)
			return NewInvalidLink(link, "bad prev pointer")
		}
		return nil
	}

	cmpSeqnos := func(prev keybase1.LinkTriple, link *chainLinkUnpacked) (err error) {
		if prev.Seqno+1 != link.Seqno() {
			m.CDebugf("Bad sequence violation: %d+1 != %d", prev.Seqno, link.Seqno())
			return NewInvalidLink(link, "seqno violation")
		}
		if prev.Seqno > 0 && prev.SeqType != link.SeqType() {
			m.CDebugf("Bad seqtype clash at seqno %d: %d != %d", link.Seqno(), prev.SeqType, link.SeqType)
			return NewInvalidLink(link, "bad seqtype")
		}
		return nil
	}

	cmp := func(prev keybase1.LinkTriple, link *chainLinkUnpacked) (err error) {
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
// TODO, see CORE-8466
func (f *FastTeamChainLoader) audit(m libkb.MetaContext, id keybase1.TeamID, isPublic bool, newLinks []*chainLinkUnpacked) (err error) {
	return nil
}

// readDownPointer reads a down pointer out of a given link, if it's unstubbed. Down pointers
// are (1) new_subteams; (2) subteam rename down pointers; and (3) subteam delete down pointers.
// Will return (nil, non-nil) if there is an error.
func readDownPointer(m libkb.MetaContext, link *chainLinkUnpacked) (*keybase1.DownPointer, error) {
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

// readUpPointer reads an up pointer out the given link, if it's unstubbed. Up pointers are
// (1) subteam heads; (2) subteam rename up pointers; and (3) subteam delete up pointers.
// Will return (nil, non-nil) if we hit any error condition.
func readUpPointer(m libkb.MetaContext, link *chainLinkUnpacked) (*keybase1.UpPointer, error) {
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
	if link.SeqType() != parent.SeqType {
		return nil, NewInvalidLink(link, "parent has wrong seq type")
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
func (f *FastTeamChainLoader) putName(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData, newLinks []*chainLinkUnpacked) (err error) {
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
func readPerTeamKey(m libkb.MetaContext, link *chainLinkUnpacked) (ret *keybase1.PerTeamKey, err error) {

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
func (f *FastTeamChainLoader) putLinks(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData, newLinks []*chainLinkUnpacked) (err error) {
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
		up, err := readUpPointer(m, link)
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
	state.LatestKeyGeneration = latestKeyGen
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
	return nil
}

// makeState does a clone on a non-nil state, or makes a new state if nil.
func makeState(arg fastLoadArg, s *keybase1.FastTeamData) *keybase1.FastTeamData {
	if s != nil {
		tmp := s.DeepCopy()
		return &tmp
	}
	return &keybase1.FastTeamData{
		PerTeamKeySeedsUnverified: make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeed),
		ReaderKeyMasks:            make(map[keybase1.TeamApplication](map[keybase1.PerTeamKeyGeneration]keybase1.MaskB64)),
		Chain: keybase1.FastTeamSigChainState{
			ID:                      arg.ID,
			Public:                  arg.Public,
			PerTeamKeys:             make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKey),
			PerTeamKeySeedsVerified: make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeed),
			DownPointers:            make(map[keybase1.Seqno]keybase1.DownPointer),
			LinkIDs:                 make(map[keybase1.Seqno]keybase1.LinkID),
		},
	}
}

// refresh the team's state, but loading with the server. It will download new stubbed chainlinks,
// fill in unstubbed chainlinks, make sure that prev pointers match, make sure that the merkle
// tree agrees with the chain tail, and then run the audit mechanism.
func (f *FastTeamChainLoader) refresh(m libkb.MetaContext, arg fastLoadArg, state *keybase1.FastTeamData, shoppingList shoppingList) (res *keybase1.FastTeamData, err error) {

	defer m.CTrace(fmt.Sprintf("FastTeamChainLoader#refresh(%+v)", arg), func() error { return err })()

	groceries, err := f.loadFromServerWithRetries(m, arg, shoppingList)
	if err != nil {
		return nil, err
	}

	// Either makes a new state, or deepcopies the existing state, so that in the case
	// of an error, we haven't corrupted what's in cache. Thus, from here on out,
	// we are playing with our own (unshared) copy of the state.
	state = makeState(arg, state)

	// check that all chain links sent down form a valid hash chain, and point
	// to what we already in had in cache.
	err = f.checkPrevs(m, state.Chain.Last, groceries.newLinks)
	if err != nil {
		return nil, err
	}

	// check that the server stubbed properly.
	err = f.checkStubs(m, shoppingList, groceries.newLinks)
	if err != nil {
		return nil, err
	}

	// peform a probabilistic audit on the new links
	err = f.audit(m, arg.ID, arg.Public, groceries.newLinks)
	if err != nil {
		return nil, err
	}

	err = f.mutateState(m, arg, state, groceries)
	if err != nil {
		return nil, err
	}

	return state, nil
}

// updateCache puts the new version of the state into the cache on the team's ID.
func (f *FastTeamChainLoader) updateCache(m libkb.MetaContext, state *keybase1.FastTeamData, lru *lru.Cache) {
	lru.Add(state.Chain.ID, state)
}

// loadLocked is the inner loop for loading team. Should be called when holding the lock
// this teamID.
func (f *FastTeamChainLoader) loadLocked(m libkb.MetaContext, arg fastLoadArg) (res *fastLoadRes, err error) {
	lru := f.getLRU()

	state := f.findStateInCache(m, arg, lru)

	var shoppingList shoppingList
	if state != nil {
		shoppingList.computeWithPreviousState(m, arg, state)
		if shoppingList.isEmpty() {
			return f.toResult(m, arg, state)
		}
	} else {
		shoppingList.computeFreshLoad(m, arg)
	}

	m.CDebugf("FastTeamChainLoader#loadLocked: computed shopping list: %+v", shoppingList)

	state, err = f.refresh(m, arg, state, shoppingList)
	if err != nil {
		return nil, err
	}
	f.updateCache(m, state, lru)

	return f.toResult(m, arg, state)
}

// newLRU installs a new LRU for the loader and purges the old one. Does a swap to avoid race conditions
// around logging out.
func (f *FastTeamChainLoader) newLRU() {

	f.lruMutex.Lock()
	defer f.lruMutex.Unlock()

	if f.lru != nil {
		f.lru.Purge()
	}

	// TODO - make this configurable
	lru, err := lru.New(10000)
	if err != nil {
		panic(err)
	}
	f.lru = lru
}

// gerLRU gets the LRU currently active for this loader under protection of the lru Mutex.
func (f *FastTeamChainLoader) getLRU() *lru.Cache {
	f.lruMutex.Lock()
	defer f.lruMutex.Unlock()
	return f.lru
}

// OnLogout is called when the user logs out, which pruges the LRU.
func (f *FastTeamChainLoader) OnLogout() {
	f.newLRU()
}
