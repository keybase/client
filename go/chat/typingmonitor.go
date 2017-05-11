package chat

import (
	"context"
	"fmt"
	"sync"
	"time"

	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/clockwork"
)

const typingTimeout = 10 * time.Second
const maxExtensions = 50

type typingControlChans struct {
	typer chat1.TyperInfo

	stopCh   chan struct{}
	extendCh chan struct{}
}

func newTypingControlChans(typer chat1.TyperInfo) *typingControlChans {
	return &typingControlChans{
		typer: typer,
		// Might not need these buffers, but we really don't want to deadlock
		stopCh:   make(chan struct{}, 5),
		extendCh: make(chan struct{}, 5),
	}
}

type TypingMonitor struct {
	globals.Contextified
	sync.Mutex
	utils.DebugLabeler

	timeout time.Duration
	clock   clockwork.Clock
	typers  map[string]*typingControlChans

	// Testing
	extendCh *chan struct{}
}

func NewTypingMonitor(g *globals.Context) *TypingMonitor {
	return &TypingMonitor{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "TypingMonitor", false),
		typers:       make(map[string]*typingControlChans),
		clock:        clockwork.NewRealClock(),
		timeout:      typingTimeout,
	}
}

func (t *TypingMonitor) SetClock(clock clockwork.Clock) {
	t.clock = clock
}

func (t *TypingMonitor) SetTimeout(timeout time.Duration) {
	t.timeout = timeout
}

func (t *TypingMonitor) key(typer chat1.TyperInfo, convID chat1.ConversationID) string {
	return fmt.Sprintf("%s:%s:%s", typer.Uid, typer.DeviceID, convID)
}

func (t *TypingMonitor) convKey(key string, convID chat1.ConversationID) bool {
	toks := strings.Split(key, ":")
	if len(toks) != 3 {
		return false
	}
	return toks[2] == convID.String()
}

func (t *TypingMonitor) notifyConvUpdateLocked(ctx context.Context, convID chat1.ConversationID) {
	var typers []chat1.TyperInfo
	for k, v := range t.typers {
		if t.convKey(k, convID) {
			typers = append(typers, v.typer)
		}
	}

	update := chat1.ConvTypingUpdate{
		ConvID: convID,
		Typers: typers,
	}
	t.G().NotifyRouter.HandleChatTypingUpdate(ctx, []chat1.ConvTypingUpdate{update})
}

func (t *TypingMonitor) Update(ctx context.Context, typer chat1.TyperInfo, convID chat1.ConversationID,
	typing bool) {

	t.Debug(ctx, "Update: %s in convID: %s updated typing to: %v", typer, convID, typing)
	key := t.key(typer, convID)

	// If this is about ourselves, then don't bother
	cuid := t.G().Env.GetUID()
	cdid := t.G().Env.GetDeviceID()
	if cuid.Equal(typer.Uid) && cdid.Eq(typer.DeviceID) {
		return
	}

	// Process the update
	t.Lock()
	chans, alreadyTyping := t.typers[key]
	t.Unlock()
	if typing {
		if alreadyTyping {
			// If this key is already typing, let's extend it
			select {
			case chans.extendCh <- struct{}{}:
			default:
				// This should never happen, but be safe
				t.Debug(ctx, "Update: overflowed extend channel, dropping update: %s convID: %s", typer,
					convID)
			}
		} else {
			// Not typing yet, just add it in and spawn waiter
			chans := newTypingControlChans(typer)
			t.insertIntoTypers(ctx, key, chans, convID)
			t.waitOnTyper(ctx, chans, convID)
		}
	} else {
		if alreadyTyping {
			// If they are typing, then stop it
			select {
			case chans.stopCh <- struct{}{}:
			default:
				// This should never happen, but be safe
				t.Debug(ctx, "Update: overflowed stop channel, dropping update: %s convID: %s", typer,
					convID)
			}
		}
	}
}

func (t *TypingMonitor) insertIntoTypers(ctx context.Context, key string, chans *typingControlChans,
	convID chat1.ConversationID) {
	t.Lock()
	defer t.Unlock()
	t.typers[key] = chans
	t.notifyConvUpdateLocked(ctx, convID)
}

func (t *TypingMonitor) removeFromTypers(ctx context.Context, key string, convID chat1.ConversationID) {
	t.Lock()
	defer t.Unlock()
	delete(t.typers, key)
	t.notifyConvUpdateLocked(ctx, convID)
}

func (t *TypingMonitor) waitOnTyper(ctx context.Context, chans *typingControlChans,
	convID chat1.ConversationID) {
	key := t.key(chans.typer, convID)
	ctx = BackgroundContext(ctx, t.G().GetEnv())
	deadline := t.clock.Now().Add(t.timeout)
	go func() {
		extends := 0
		for {
			select {
			case <-t.clock.AfterTime(deadline):
				// Send notifications and bail
				t.removeFromTypers(ctx, key, convID)
				return
			case <-chans.extendCh:
				// Loop around to restart timer
				extends++
				if extends > maxExtensions {
					t.Debug(ctx, "waitOnTyper: max extensions reached: uid: %s convID: %s", chans.typer.Uid, convID)
					t.removeFromTypers(ctx, key, convID)
					return
				}
				deadline = t.clock.Now().Add(t.timeout)
				if t.extendCh != nil {
					// Alerts tests we extended time
					*t.extendCh <- struct{}{}
				}
				continue
			case <-chans.stopCh:
				// Stopped typing, just end it and remove entry in typers
				t.removeFromTypers(ctx, key, convID)
				return
			}
		}
	}()
}
