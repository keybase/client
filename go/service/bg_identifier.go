
package service

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"time"
)

type bgiUser struct {
	uid keybase1.UID
	lastID time.Time
}

type BackgroundIdentifier struct {
	libkb.Contextified
	queue []bgiUser
	members map[keybase1.UID]bool
	deletions map[keybase1.UID]bool
}

func NewBackgroundIdentifier(g *libkb.GlobalContext) *BackgroundIdentifier {
	return &BackgroundIdentifier{
		Contextified : libkb.NewContextified(g),
		members : make(map[keybase1.UID]bool),
		deletions : make(map[keybase1.UID]bool),
	}
}

func (b *BackgroundIdentifier) Add(u keybase1.UID) bool {
	if b.members[u] {
		return false
	}
	b.queue = append(b.queue, bgiUser{ uid : u })
	b.members[u] = true
	delete(b.deletions, u)
	return true
}

func (b *BackgroundIdentifier) Remove(u keybase1.UID) {
	b.deletions[u] = true
}

func (b *BackgroundIdentifier) waitTime() time.Duration {
	return time.Duration(0)
}

func (b *BackgroundIdentifier) Run(until <-chan struct{}) {
	for {
		select {
		case <-until:
			break
		case <-time.After(b.waitTime()):
			b.runNext()
		}
	}

}

func (b *BackgroundIdentifier) runNext() error {
	return nil
}

func (b *BackgroundIdentifier) runOne(u keybase1.UID) error {
	return nil
}