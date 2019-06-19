package hidden

import (
	"fmt"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	sig3 "github.com/keybase/client/go/sig3"
	storage "github.com/keybase/client/go/teams/storage"
)

// ChainManager manages a hidden team chain, and wraps put/gets to mem/disk storage.
// Accesses are single-flighted by TeamID. Implements that libkb.HiddenTeamChainManager
// interface.
type ChainManager struct {
	// single-flight lock on TeamID
	locktab libkb.LockTable

	// Hold onto FastTeamLoad by-products as long as we have room, and store
	// them persistently to disk.
	storage *storage.HiddenStorage
}

var _ libkb.HiddenTeamChainManager = (*ChainManager)(nil)

type loadArg struct {
	id     keybase1.TeamID
	mutate func(libkb.MetaContext, *keybase1.HiddenTeamChain) (bool, error)
}

// Tail returns the furthest known tail of the hidden team chain, as known to our local cache.
// Needed when posting new main chain links that point back to the most recently known tail.
func (m *ChainManager) Tail(mctx libkb.MetaContext, id keybase1.TeamID) (*keybase1.LinkTriple, error) {
	mctx = withLogTag(mctx)
	state, err := m.loadAndMutate(mctx, loadArg{id: id})
	if err != nil {
		return nil, err
	}
	if state == nil {
		return nil, nil
	}
	return state.Ratchet.MaxTriple(), nil
}

func (m *ChainManager) loadLocked(mctx libkb.MetaContext, arg loadArg) (ret *keybase1.HiddenTeamChain, err error) {
	state, frozen, tombstoned := m.storage.Get(mctx, arg.id, arg.id.IsPublic())
	if frozen {
		return nil, NewManagerError("cannot load hidden chain for frozen team")
	}
	if tombstoned {
		return nil, NewManagerError("cannot load hidden chain for tombstoned team")
	}
	return state, nil
}

func withLogTag(mctx libkb.MetaContext) libkb.MetaContext {
	return mctx.WithLogTag("HTCM")
}

// Load hidden team chain data from storage, either mem or disk. Will not hit the network.
func (m *ChainManager) Load(mctx libkb.MetaContext, id keybase1.TeamID) (ret *keybase1.HiddenTeamChain, err error) {
	mctx = withLogTag(mctx)
	ret, err = m.loadAndMutate(mctx, loadArg{id: id})
	return ret, err
}

func (m *ChainManager) loadAndMutate(mctx libkb.MetaContext, arg loadArg) (state *keybase1.HiddenTeamChain, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("ChainManager#load(%+v)", arg), func() error { return err })()
	lock := m.locktab.AcquireOnName(mctx.Ctx(), mctx.G(), arg.id.String())
	defer lock.Release(mctx.Ctx())

	state, err = m.loadLocked(mctx, arg)
	if err != nil {
		return nil, err
	}

	if arg.mutate != nil {
		var changed bool
		if state == nil {
			state = keybase1.NewHiddenTeamChain(arg.id)
		}
		changed, err = arg.mutate(mctx, state)
		if err != nil {
			return nil, err
		}
		if changed {
			state.CachedAt = keybase1.ToTime(mctx.G().Clock().Now())
			m.storage.Put(mctx, state)
		}
	}

	return state, nil
}

func (m *ChainManager) checkRatchet(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain, ratchet keybase1.LinkTripleAndTime) (err error) {
	if ratchet.Triple.SeqType != sig3.ChainTypeTeamPrivateHidden {
		return NewManagerError("bad chain type: %s", ratchet.Triple.SeqType)
	}

	// The new ratchet can't clash the existing accepted ratchets
	for _, accepted := range state.Ratchet.Flat() {
		if accepted.Clashes(ratchet) {
			return NewManagerError("bad ratchet, clashes existing pin: %+v != %v", accepted, accepted)
		}
	}

	q := ratchet.Triple.Seqno
	link, ok := state.Outer[q]

	// If either the ratchet didn't match a known link, or equals what's already there, great.
	if ok && !link.Eq(ratchet.Triple.LinkID) {
		return NewManagerError("Ratchet failed to match a currently accepted chainlink: %+v", ratchet)
	}

	return nil
}

func (m *ChainManager) checkRatchets(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain, ratchet keybase1.HiddenTeamChainRatchet) (err error) {
	for _, r := range ratchet.Flat() {
		err = m.checkRatchet(mctx, state, r)
		if err != nil {
			return err
		}
	}
	return nil
}

func (m *ChainManager) ratchet(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain, ratchet keybase1.HiddenTeamChainRatchet) (ret bool, err error) {
	err = m.checkRatchets(mctx, state, ratchet)
	if err != nil {
		return false, err
	}
	updated := state.Ratchet.Merge(ratchet)
	return updated, nil
}

// Ratchet should be called when we know about advances in this chain but don't necessarily have the links to back the
// ratchet up. We'll check them later when next we refresh. But we do check that the ratchet is consistent with the known
// data (and ratchets) that we have.
func (m *ChainManager) Ratchet(mctx libkb.MetaContext, id keybase1.TeamID, ratchet keybase1.HiddenTeamChainRatchet) (err error) {
	mctx = withLogTag(mctx)
	defer mctx.Trace(fmt.Sprintf("hidden.ChainManager#Ratchet(%s, %+v)", id, ratchet), func() error { return err })()
	arg := loadArg{
		id: id,
		mutate: func(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain) (bool, error) {
			return m.ratchet(mctx, state, ratchet)
		},
	}
	_, err = m.loadAndMutate(mctx, arg)
	if err != nil {
		return err
	}
	return nil
}

func (m *ChainManager) checkPrev(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain, newData keybase1.HiddenTeamChain, expectedPrev *keybase1.LinkTriple) (err error) {
	if expectedPrev == nil {
		_, ok := newData.Outer[keybase1.Seqno(1)]
		if !ok {
			return NewManagerError("if no prev given, a head link is required")
		}
		return nil
	}
	link, ok := state.Outer[expectedPrev.Seqno]
	if !ok {
		return NewManagerError("update at %v left a chain gap", *expectedPrev)
	}
	if !link.Eq(expectedPrev.LinkID) {
		return NewManagerError("prev mismatch at %v", *expectedPrev)
	}
	return nil
}

func (m *ChainManager) advance(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain, newData keybase1.HiddenTeamChain, expectedPrev *keybase1.LinkTriple) (update bool, err error) {
	err = m.checkRatchetsOnAdvance(mctx, state.Ratchet, newData)
	if err != nil {
		return false, err
	}
	err = m.checkPrev(mctx, state, newData, expectedPrev)
	if err != nil {
		return false, err
	}
	update, err = state.Merge(newData)
	if err != nil {
		return false, err
	}
	return update, nil
}

func (m *ChainManager) checkRatchetOnAdvance(mctx libkb.MetaContext, r keybase1.LinkTripleAndTime, newData keybase1.HiddenTeamChain) (err error) {
	q := r.Triple.Seqno
	link, ok := newData.Outer[q]
	if ok && !link.Eq(r.Triple.LinkID) {
		return NewManagerError("update data failed to match ratchet %+v", r)
	}
	return nil
}

func (m *ChainManager) checkRatchetsOnAdvance(mctx libkb.MetaContext, ratchet keybase1.HiddenTeamChainRatchet, newData keybase1.HiddenTeamChain) (err error) {
	for _, r := range ratchet.Flat() {
		err = m.checkRatchetOnAdvance(mctx, r, newData)
		if err != nil {
			return err
		}
	}
	return nil
}

// Advance the stored hidden team storage by the given update. Before this function is called, we should
// have checked many things:
//  - that the PTKs match the unverified seeds sent down by the server.
//  - that the postImages of the seedChecks are continuous, given a consistent set of seeds
//  - that all full (unstubbed links) have valid reverse signatures
//  - that all prevs are self consistent, and consistent with any preloaded data
//  - that if the update starts in the middle of the chain, that its head has a prev, and that prev is consistent.
//  - that the updates are consistent with any known ratchets
// See hidden.go for and the caller of this function for where that happens.
func (m *ChainManager) Advance(mctx libkb.MetaContext, dat keybase1.HiddenTeamChain, expectedPrev *keybase1.LinkTriple) (err error) {
	mctx = withLogTag(mctx)
	defer mctx.Trace(fmt.Sprintf("hidden.ChainManager#Advance(%s)", dat.ID()), func() error { return err })()
	arg := loadArg{
		id: dat.ID(),
		mutate: func(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain) (bool, error) {
			return m.advance(mctx, state, dat, expectedPrev)
		},
	}
	_, err = m.loadAndMutate(mctx, arg)
	if err != nil {
		return err
	}
	return nil
}

func NewChainManager(g *libkb.GlobalContext) *ChainManager {
	return &ChainManager{
		storage: storage.NewHiddenStorage(g),
	}
}

func NewChainManagerAndInstall(g *libkb.GlobalContext) *ChainManager {
	ret := NewChainManager(g)
	g.SetHiddenTeamChainManager(ret)
	g.AddLogoutHook(ret, "HiddenTeamChainManager")
	g.AddDbNukeHook(ret, "HiddenTeamChainManager")
	return ret
}

// OnLogout is called when the user logs out, which purges the LRU.
func (m *ChainManager) OnLogout(mctx libkb.MetaContext) error {
	m.storage.ClearMem()
	return nil
}

// OnDbNuke is called when the disk cache is cleared, which purges the LRU.
func (m *ChainManager) OnDbNuke(mctx libkb.MetaContext) error {
	m.storage.ClearMem()
	return nil
}
