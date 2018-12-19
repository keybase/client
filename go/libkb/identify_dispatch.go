package libkb

import (
	"sync"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type IdentifyDispatchMsg struct {
	Target keybase1.UID
}

type IdentifyDispatch struct {
	sync.Mutex
	listeners []chan<- IdentifyDispatchMsg
}

func NewIdentifyDispatch() *IdentifyDispatch { return &IdentifyDispatch{} }

// NotifyTrackingSuccess notifies listeners that a target user has been found to satisfy tracking.
// This could be through
// - An identify call that heeded the active user's tracking of the target.
// - A user tracked or untracked the target.
// When the active user is the target all bets are off.
func (d *IdentifyDispatch) NotifyTrackingSuccess(mctx MetaContext, target keybase1.UID) {
	mctx.CDebugf("IdentifyDispatch.NotifyTrackingSuccess(%v)", target)
	d.Lock()
	defer d.Unlock()
	for _, listener := range d.listeners {
		select {
		case listener <- IdentifyDispatchMsg{Target: target}:
		default:
		}
	}
}

// Subscribe to notifications.
// `unsubscribe` releases resources associated with the subscription and should be called asap.
func (d *IdentifyDispatch) Subscribe(mctx MetaContext) (unsubscribe func(), recvCh <-chan IdentifyDispatchMsg) {
	mctx.CDebugf("IdentifyDispatch.Subscribe")
	ch := make(chan IdentifyDispatchMsg, 10)
	d.Lock()
	defer d.Unlock()
	d.listeners = append(d.listeners, ch)
	unsubscribe = func() {
		mctx.CDebugf("IdentifyDispatch.Unsubcribe")
		d.Lock()
		defer d.Unlock()
		var listeners []chan<- IdentifyDispatchMsg
		for _, ch2 := range d.listeners {
			if ch == ch2 {
				continue
			}
			listeners = append(listeners, ch2)
		}
		d.listeners = listeners
	}
	return unsubscribe, ch
}

// OnLogout drops all subscriptions.
func (d *IdentifyDispatch) OnLogout() {
	d.Lock()
	defer d.Unlock()
	d.listeners = nil
}
