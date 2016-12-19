package service

import (
	"errors"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"sync"
)

type uidSet map[keybase1.UID]bool

func newUIDSet(v []keybase1.UID) uidSet {
	ret := make(uidSet)
	for _, e := range v {
		ret[e] = true
	}
	return ret
}

func (a uidSet) subtract(b uidSet) uidSet {
	ret := make(uidSet)
	for e := range a {
		if !b[e] {
			ret[e] = true
		}
	}
	return ret
}

type BackgroundIdentifier struct {
	libkb.Contextified
	sync.Mutex
	uid             keybase1.UID
	engine          *engine.BackgroundIdentifier
	stopCh          chan<- struct{}
	isDead          bool
	lastFollowerSet uidSet
}

func newBackgroundIdentifier(g *libkb.GlobalContext, u keybase1.UID) (*BackgroundIdentifier, error) {

	ch := make(chan struct{})
	eng := engine.NewBackgroundIdentifier(g, ch)
	ret := &BackgroundIdentifier{
		Contextified:    libkb.NewContextified(g),
		uid:             u,
		engine:          eng,
		stopCh:          ch,
		lastFollowerSet: newUIDSet(nil),
	}

	err := ret.populateWithFollowees()
	if err != nil {
		return nil, err
	}

	go func() {
		err := engine.RunEngine(eng, &engine.Context{})
		if err != nil {
			g.Log.Warning("Background identifier failed: %s\n", err)
		}
	}()
	return ret, nil
}

func StartOrReuseBackgroundIdentifier(b *BackgroundIdentifier, g *libkb.GlobalContext, u keybase1.UID) (*BackgroundIdentifier, error) {
	if b == nil {
		return newBackgroundIdentifier(g, u)
	}
	return b.reuse(u)
}

func (b *BackgroundIdentifier) populateWithFollowees() error {
	b.Lock()
	defer b.Unlock()
	return b.populateWithFolloweesLocked()
}

func (b *BackgroundIdentifier) populateWithFolloweesLocked() error {
	uids, err := b.G().CachedUserLoader.ListFollowedUIDs(b.uid)
	if err != nil {
		return err
	}
	newSet := newUIDSet(uids)
	additions := newSet.subtract(b.lastFollowerSet)
	for u := range additions {
		b.engine.Add(u)
	}
	removals := b.lastFollowerSet.subtract(newSet)
	for u := range removals {
		b.engine.Remove(u)
	}
	b.lastFollowerSet = newSet
	return nil
}

func (b *BackgroundIdentifier) Shutdown() {
	b.Lock()
	defer b.Unlock()
	b.shutdownLocked()
}

func (b *BackgroundIdentifier) shutdownLocked() {
	defer b.G().Trace("BackgroundIdentifier#Shutdown", func() error { return nil })()
	if b.isDead {
		b.G().Log.Debug("identifier was already shutdown")
		return
	}
	b.isDead = true

	// Do this in the background in case the BG Identifier is currently working
	// on something.
	go func() {
		b.stopCh <- struct{}{}
	}()
}

func (b *BackgroundIdentifier) Logout() { b.Shutdown() }

func (b *BackgroundIdentifier) reuse(u keybase1.UID) (bgi *BackgroundIdentifier, err error) {
	defer b.G().Trace("BackgroundIdentifier#reuse", func() error { return err })()
	b.Lock()
	defer b.Unlock()
	if b.uid.Equal(u) && !b.isDead {
		return nil, nil
	}
	b.shutdownLocked()
	return newBackgroundIdentifier(b.G(), u)
}

func (b *BackgroundIdentifier) HandleUserChanged(uid keybase1.UID) error {
	b.Lock()
	defer b.Unlock()

	if b.isDead {
		b.G().Log.Debug("BackgroundIdentifier: dead identifier")
		return errors.New("identifier is dead")
	}
	if !b.uid.Equal(uid) {
		b.G().Log.Debug("BackgroundIdentifier: UID mismatch on update: %s != %s", b.uid, uid)
		return nil
	}
	// swallow error
	err := b.populateWithFolloweesLocked()
	if err != nil {
		b.G().Log.Warning("BackgroundIdentifier: failed to populate with new followees: %s", err)
	}
	return nil
}

var _ libkb.UserChangedHandler = (*BackgroundIdentifier)(nil)
