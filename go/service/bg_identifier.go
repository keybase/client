package service

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/jonboulle/clockwork"
	"time"
	"sync"
)

type bgiUser struct {
	uid    keybase1.UID
	lastRun time.Time
}

type BackgroundIdentifier struct {
	libkb.Contextified
	sync.Mutex
	queue     []bgiUser
	members   map[keybase1.UID]bool
	deletions map[keybase1.UID]bool
	addCh chan struct{}
	clock clockwork.Clock
}

func NewBackgroundIdentifier(g *libkb.GlobalContext, cl clockwork.Clock) *BackgroundIdentifier {
	return &BackgroundIdentifier{
		Contextified: libkb.NewContextified(g),
		members:      make(map[keybase1.UID]bool),
		deletions:    make(map[keybase1.UID]bool),
		addCh: make(chan struct{}),
		clock: cl,
	}
}

func (b *BackgroundIdentifier) Add(u keybase1.UID) bool {
	b.Lock()
	defer b.Unlock()
	if b.members[u] {
		return false
	}
	b.queue = append(b.queue, bgiUser{uid: u})
	b.members[u] = true
	delete(b.deletions, u)
	go func() {
		b.addCh<-struct{}{}
	}()
	return true
}

func (b *BackgroundIdentifier) Remove(u keybase1.UID) {
	b.Lock()
	defer b.Unlock()
	b.deletions[u] = true
}

func (b *BackgroundIdentifier) waitTime() time.Duration {
	b.Lock()
	defer b.Unlock()
	if len(b.queue) == 0 {
		return time.Hour
	}
	if b.queue[0].lastRun.IsZero() {
		return time.Duration(0)
	}
	diff := 4*time.Hour - b.clock.Now().Sub(b.queue[0].lastRun)
	if diff < 0  {
		return time.Duration(0)
	}
	return diff
}

func (b *BackgroundIdentifier) Run(untilCh <-chan struct{}) {
	for {
		select {
		case <-untilCh:
			break
		case <-b.addCh:
			continue
		case <-b.clock.After(b.waitTime()):
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
