package service

import (
	"errors"
	"fmt"
	"sync"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
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
	globals.ChatContextified

	sync.Mutex
	uid             keybase1.UID
	engine          *engine.BackgroundIdentifier
	stopCh          chan<- struct{}
	isDead          bool
	lastFollowerSet uidSet
	snooperCh       chan<- engine.IdentifyJob
}

func newBackgroundIdentifier(g *libkb.GlobalContext, cg *globals.ChatContext, u keybase1.UID) (*BackgroundIdentifier, error) {

	ch := make(chan struct{})
	sch := make(chan engine.IdentifyJob, 100)
	eng := engine.NewBackgroundIdentifier(g, ch)
	ret := &BackgroundIdentifier{
		Contextified:     libkb.NewContextified(g),
		ChatContextified: globals.NewChatContextified(cg),
		uid:              u,
		engine:           eng,
		stopCh:           ch,
		lastFollowerSet:  newUIDSet(nil),
	}

	err := ret.populateWithFollowees()
	if err != nil {
		return nil, err
	}

	go func() {
		eng.SetSnooperChannel(sch)
		err := engine.RunEngine(eng, &engine.Context{NetContext: context.Background()})
		if err != nil {
			g.Log.Warning("Background identifier failed: %s\n", err)
		}
		close(sch)
	}()

	go func() {
		for ij := range sch {
			ret.completedIdentifyJob(ij)
		}
	}()

	return ret, nil
}

func StartOrReuseBackgroundIdentifier(b *BackgroundIdentifier, g *libkb.GlobalContext,
	cg *globals.ChatContext, u keybase1.UID) (*BackgroundIdentifier, error) {
	if b == nil {
		return newBackgroundIdentifier(g, cg, u)
	}
	return b.reuse(u)
}

func (b *BackgroundIdentifier) completedIdentifyJob(ij engine.IdentifyJob) {
	if !ij.ErrorChanged() {
		return
	}
	b.G().Log.Debug("| Identify(%s) changed: %v -> %v", ij.UID(), ij.ThisError(), ij.LastError())

	// Let the chat system know about this identify change
	cg := globals.NewContext(b.G(), b.ChatG())
	chat.NewIdentifyChangedHandler(cg, chat.NewKBFSTLFInfoSource(cg)).BackgroundIdentifyChanged(context.Background(), ij)
}

func (b *BackgroundIdentifier) populateWithFollowees() (err error) {
	defer b.G().Trace("BackgroundIdentifier#populateWithFollowees", func() error { return err })
	b.Lock()
	defer b.Unlock()
	err = b.populateWithFolloweesLocked()
	return err
}

func (b *BackgroundIdentifier) populateWithFolloweesLocked() error {
	uids, err := b.G().GetUPAKLoader().ListFollowedUIDs(b.uid)
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
	// Don't block logout or shutdown. Otherwise, we might get deadlock.
	go func() {
		b.Lock()
		defer b.Unlock()
		b.shutdownLocked()
	}()
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
	return newBackgroundIdentifier(b.G(), b.ChatG(), u)
}

func (b *BackgroundIdentifier) HandleUserChanged(uid keybase1.UID) (err error) {
	defer b.G().Trace(fmt.Sprintf("BackgroundIdentifier#HandleUserChanged(%s)", uid), func() error { return err })()
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
	err = b.populateWithFolloweesLocked()
	if err != nil {
		b.G().Log.Warning("BackgroundIdentifier: failed to populate with new followees: %s", err)
		err = nil
	}
	return nil
}

var _ libkb.UserChangedHandler = (*BackgroundIdentifier)(nil)
