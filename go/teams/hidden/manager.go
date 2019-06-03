package hidden

import (
	"fmt"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	sig3 "github.com/keybase/client/go/sig3"
	storage "github.com/keybase/client/go/teams/storage"
)

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

func (m *ChainManager) LastSeqno(mctx libkb.MetaContext, id keybase1.TeamID) (keybase1.Seqno, keybase1.Seqno, error) {
	mctx = withLogTag(mctx)
	state, err := m.loadAndMutate(mctx, loadArg{id: id})
	if err != nil {
		return keybase1.Seqno(0), keybase1.Seqno(0), err
	}
	if state == nil {
		return keybase1.Seqno(0), keybase1.Seqno(0), nil
	}
	return state.Data.Last, state.Ratchet.Max(), nil
}

func (m *ChainManager) Tail(mctx libkb.MetaContext, id keybase1.TeamID) (*keybase1.LinkTriple, error) {
	mctx = withLogTag(mctx)
	state, err := m.loadAndMutate(mctx, loadArg{id: id})
	if err != nil {
		return nil, err
	}
	return state.Ratchet.MaxTriple(), nil
}

func (m *ChainManager) loadLocked(mctx libkb.MetaContext, arg loadArg) (ret *keybase1.HiddenTeamChain, err error) {
	state, frozen, tombstoned := m.storage.Get(mctx, arg.id, arg.id.IsPublic())
	if frozen {
		return nil, fmt.Errorf("cannot load hidden chain for frozen team")
	}
	if tombstoned {
		return nil, fmt.Errorf("cannot load hidden chain for tombstoned team")
	}
	return state, nil
}

func withLogTag(mctx libkb.MetaContext) libkb.MetaContext {
	return mctx.WithLogTag("HTCM")
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
			state = newHiddenTeamChain()
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

func (m *ChainManager) checkRatchet(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain, ratchet keybase1.LinkTripleAndTime) (changed bool, err error) {
	if ratchet.Triple.SeqType != sig3.ChainTypeTeamPrivateHidden {
		return false, fmt.Errorf("bad chain type: %s", ratchet.Triple.SeqType)
	}

	// The new ratchet can't clash the existing accepted ratchets
	for _, accepted := range state.Ratchet.Flat() {
		if accepted.Clashes(ratchet) {
			return false, fmt.Errorf("bad ratchet, clashes existing pin: %+v != %v", accepted, accepted)
		}
	}

	q := ratchet.Triple.Seqno
	link, ok := state.Data.Outer[q]

	// If either the ratchet didn't match a known link, or equals what's already there, great.
	if !ok || link.Eq(ratchet.Triple.LinkID) {
		return false, nil
	}

	// If the ratchet clashes with links we have already accepted, something is really wrong, and we
	// have to bail out. Likely this team is totally hosed.
	if ratchet.Triple.Seqno <= state.Ratchet.Max() {
		return false, fmt.Errorf("Ratchet failed to match a currently accepted chainlink: %+v", ratchet)
	}

	// We can recover in a case in which we held provisional links that came after the last known Ratchet.
	// We just have to remove those links though and then start again.
	for i := state.Data.Last; i >= ratchet.Triple.Seqno; i-- {
		mctx.Warning("Removing link at %d, since it is in front of a ratchet that it clashes with (%+v)", ratchet)
		state.RemoveLink(i)
	}

	return true, nil
}

func (m *ChainManager) checkRatchets(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain, ratchet keybase1.HiddenTeamChainRatchet) (changed bool, err error) {
	for _, r := range ratchet.Flat() {
		tmp, err := m.checkRatchet(mctx, state, r)
		if err != nil {
			return false, err
		}
		if tmp {
			changed = true
		}
	}
	return changed, nil
}

func newHiddenTeamChain() *keybase1.HiddenTeamChain {
	return &keybase1.HiddenTeamChain{
		ReaderPerTeamKeys: make(map[keybase1.PerTeamKeyGeneration]keybase1.Seqno),
	}
}

func (m *ChainManager) ratchet(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain, ratchet keybase1.HiddenTeamChainRatchet) (ret bool, err error) {
	var provisionalLinksDeleted bool
	provisionalLinksDeleted, err = m.checkRatchets(mctx, state, ratchet)
	if err != nil {
		return false, err
	}
	updated := state.Ratchet.Merge(ratchet)
	return (updated || provisionalLinksDeleted), nil
}

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

func (m *ChainManager) checkPrev(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain, prev keybase1.LinkTriple) (err error) {
	if prev.Seqno == keybase1.Seqno(0) {
		return nil
	}
	link, ok := state.Data.Outer[prev.Seqno]
	if !ok {
		return fmt.Errorf("cannot advance change since prev %+v wasn't found", prev)
	}
	if !link.Eq(prev.LinkID) {
		return fmt.Errorf("prev mismatch at %+v", prev)
	}
	return nil
}

func (m *ChainManager) checkExpectedHighSeqno(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain, newData keybase1.HiddenTeamChainData, expectedHighSeqno keybase1.Seqno) error {
	if state.Data.HasSeqno(expectedHighSeqno) || newData.HasSeqno(expectedHighSeqno) {
		return nil
	}
	return fmt.Errorf("we expected a chain up to %d but it wasn't returned from the server", expectedHighSeqno)
}

func (m *ChainManager) advance(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain, prev keybase1.LinkTriple, newData keybase1.HiddenTeamChainData, expectedHighSeqno keybase1.Seqno) (update bool, err error) {
	err = m.checkPrev(mctx, state, prev)
	if err != nil {
		return false, err
	}
	err = m.checkRatchetsOnAdvance(mctx, state.Ratchet, newData)
	if err != nil {
		return false, err
	}
	err = m.checkExpectedHighSeqno(mctx, state, newData, expectedHighSeqno)
	if err != nil {
		return false, err
	}
	update = state.Merge(newData)
	return update, nil
}

func (m *ChainManager) checkRatchetOnAdvance(mctx libkb.MetaContext, r keybase1.LinkTripleAndTime, newData keybase1.HiddenTeamChainData) (err error) {
	q := r.Triple.Seqno
	link, ok := newData.Outer[q]
	if ok && !link.Eq(r.Triple.LinkID) {
		return fmt.Errorf("update data failed to match ratchet %+v", r)
	}
	return nil
}

func (m *ChainManager) checkRatchetsOnAdvance(mctx libkb.MetaContext, ratchet keybase1.HiddenTeamChainRatchet, newData keybase1.HiddenTeamChainData) (err error) {
	for _, r := range ratchet.Flat() {
		err = m.checkRatchetOnAdvance(mctx, r, newData)
		if err != nil {
			return err
		}
	}
	return nil
}

func (m *ChainManager) Advance(mctx libkb.MetaContext, prev keybase1.LinkTriple, dat keybase1.HiddenTeamChainData, ratchet keybase1.Seqno) (err error) {
	mctx = withLogTag(mctx)
	defer mctx.Trace(fmt.Sprintf("hidden.ChainManager#Advance(%s)", dat.ID), func() error { return err })()
	arg := loadArg{
		id: dat.ID,
		mutate: func(mctx libkb.MetaContext, state *keybase1.HiddenTeamChain) (bool, error) {
			return m.advance(mctx, state, prev, dat, ratchet)
		},
	}
	_, err = m.loadAndMutate(mctx, arg)
	if err != nil {
		return err
	}
	return nil
}

func (m *ChainManager) PerTeamKeyAtGeneration(mctx libkb.MetaContext, id keybase1.TeamID, ptkg keybase1.PerTeamKeyGeneration) (ret *keybase1.PerTeamKey, err error) {
	mctx = withLogTag(mctx)
	defer mctx.Trace(fmt.Sprintf("hidden.ChainManager#PerTeamKeyGeneration(%s)", id), func() error { return err })()
	arg := loadArg{id: id}
	state, err := m.loadAndMutate(mctx, arg)
	if err != nil {
		return nil, err
	}
	if state == nil {
		mctx.Debug("no state found for team")
		return nil, nil
	}
	q, ok := state.ReaderPerTeamKeys[ptkg]
	if !ok {
		mctx.Debug("no link found for generation")
		return nil, nil
	}
	i, ok := state.Data.Inner[q]
	if !ok {
		mctx.Debug("no inner link for for seqno %d", q)
		return nil, nil
	}
	ptk, ok := i.Ptk[keybase1.PTKType_READER]
	if !ok {
		mctx.Debug("no reader key found at seqno %d", q)
		return nil, nil
	}
	return &ptk.Ptk, nil
}

func NewChainMananger() *ChainManager {
	return &ChainManager{}
}
