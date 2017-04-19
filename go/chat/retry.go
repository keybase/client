package chat

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	context "golang.org/x/net/context"
)

const fetchInitialInterval = 5 * time.Second
const fetchMultiplier = 1.5
const fetchMaxTime = 24 * time.Hour

type FetchRetrier struct {
	libkb.Contextified
	utils.DebugLabeler
	sync.Mutex

	forceCh    chan struct{}
	shutdownCh chan chan struct{}
	clock      clockwork.Clock
	offline    bool
}

func NewFetchRetrier(g *libkb.GlobalContext) *FetchRetrier {
	f := &FetchRetrier{
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "FetchRetrier", false),
		clock:        clockwork.NewRealClock(),
		forceCh:      make(chan struct{}, 10),
		shutdownCh:   make(chan chan struct{}, 1),
	}
	return f
}

func (f *FetchRetrier) boxKey(kind types.FetchType) string {
	return fmt.Sprintf("%v", kind)
}

func (f *FetchRetrier) Failure(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	kind types.FetchType) (err error) {
	defer f.Trace(ctx, func() error { return err }, fmt.Sprintf("Failure(%s)", convID))()

	return storage.NewConversationFailureBox(f.G(), uid, f.boxKey(kind)).Failure(ctx, convID)
}

func (f *FetchRetrier) Success(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	kind types.FetchType) (err error) {
	defer f.Trace(ctx, func() error { return err }, fmt.Sprintf("Success(%s)", convID))()

	return storage.NewConversationFailureBox(f.G(), uid, f.boxKey(kind)).Success(ctx, convID)
}

func (f *FetchRetrier) Connected(ctx context.Context) {
	defer f.Trace(ctx, func() error { return nil }, "Connected")()
	f.Lock()
	f.offline = false
	f.Unlock()
	f.forceCh <- struct{}{}
}

func (f *FetchRetrier) Disconnected(ctx context.Context) {
	f.Lock()
	defer f.Unlock()
	f.offline = true
}

func (f *FetchRetrier) IsOffline() bool {
	f.Lock()
	defer f.Unlock()
	return f.offline
}

func (f *FetchRetrier) Start(ctx context.Context, uid gregor1.UID) {
	defer f.Trace(ctx, func() error { return nil }, "Start")()
	go f.retryLoop(uid)
}

func (f *FetchRetrier) Stop(ctx context.Context) chan struct{} {
	defer f.Trace(ctx, func() error { return nil }, "Stop")()
	cb := make(chan struct{})
	f.shutdownCh <- cb
	return cb
}

func (f *FetchRetrier) retryLoop(uid gregor1.UID) {
	for {
		select {
		case <-f.clock.After(fetchInitialInterval):
			f.retryOnce(uid, false)
		case <-f.forceCh:
			f.retryOnce(uid, true)
		case cb := <-f.shutdownCh:
			defer close(cb)
			return
		}
	}
}

func (f *FetchRetrier) nextAttemptTime(attempts int, lastAttempt time.Time) time.Time {
	wait := time.Duration(float64(attempts) * fetchMultiplier * float64(fetchInitialInterval))
	return lastAttempt.Add(time.Duration(wait))
}

func (f *FetchRetrier) filterFailuresByTime(ctx context.Context,
	convFailures []storage.ConversationFailureRecord, force bool) (res []chat1.ConversationID) {
	now := f.clock.Now()
	for _, conv := range convFailures {
		next := f.nextAttemptTime(conv.Attempts, gregor1.FromTime(conv.LastAttempt))
		if force || next.Before(now) {
			res = append(res, conv.ConvID)

			// Output debug info about next time
			if force {
				f.Debug(ctx, "filterFailuresByTime: including convID: %s (forced)", conv.ConvID)
			} else {
				next = f.nextAttemptTime(conv.Attempts+1, f.clock.Now())
				f.Debug(ctx, "filterFailuresByTime: including convID: %s attempts: %d next: %v",
					conv.ConvID, conv.Attempts, next)
			}
		}
	}
	return res
}

func (f *FetchRetrier) retryInboxLoads(uid gregor1.UID, force bool) {
	var err error
	var breaks []keybase1.TLFIdentifyFailure
	box := storage.NewConversationFailureBox(f.G(), uid, f.boxKey(types.InboxLoad))
	ctx := Context(context.Background(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &breaks,
		NewIdentifyNotifier(f.G()))

	var convFailures []storage.ConversationFailureRecord
	convFailures, err = box.Read(ctx)
	if err != nil {
		f.Debug(ctx, "retryInboxLoads: failed to read failure box, giving up: %s", err.Error())
		return
	}
	convIDs := f.filterFailuresByTime(ctx, convFailures, force)
	if len(convIDs) == 0 {
		return
	}

	// Reload these all conversations and hope they work
	f.Debug(ctx, "retryInboxLoads: retrying %d conversations", len(convFailures))
	inbox, _, err := f.G().InboxSource.Read(ctx, uid, nil, true, &chat1.GetInboxLocalQuery{
		ConvIDs: convIDs,
	}, nil)
	if err != nil {
		f.Debug(ctx, "retryInboxLoads: failed to read inbox: %s", err.Error())
		return
	}
	var fixed []chat1.ConversationID
	for _, conv := range inbox.Convs {
		if conv.Error == nil {
			f.Debug(ctx, "retryInboxLoads: fixed convID: %s", conv.GetConvID())
			fixed = append(fixed, conv.GetConvID())
			if err := f.Success(ctx, conv.GetConvID(), uid, types.InboxLoad); err != nil {
				f.Debug(ctx, "retryInboxLoads: failure running Success: %s", err.Error())
			}
		} else {
			f.Debug(ctx, "retryInboxLoads: convID failed again: msg: %s typ: %v", conv.Error.Message,
				conv.Error.Typ)
			if err := box.Failure(ctx, conv.GetConvID()); err != nil {
				f.Debug(ctx, "retryInboxLoads: failure running Failure: %s", err.Error())
			}
		}
	}

	f.Debug(ctx, "retryInboxLoads: sending %d stale notifications", len(fixed))
	f.G().ChatSyncer.SendChatStaleNotifications(ctx, uid, fixed, false)
}

func (f *FetchRetrier) retryThreadLoads(uid gregor1.UID, force bool) {
	var err error
	var breaks []keybase1.TLFIdentifyFailure
	box := storage.NewConversationFailureBox(f.G(), uid, f.boxKey(types.ThreadLoad))
	ctx := Context(context.Background(), keybase1.TLFIdentifyBehavior_CHAT_GUI, &breaks,
		NewIdentifyNotifier(f.G()))

	var convFailures []storage.ConversationFailureRecord
	convFailures, err = box.Read(ctx)
	if err != nil {
		f.Debug(ctx, "retryThreadLoads: failed to read failure box, giving up: %s", err.Error())
		return
	}
	convIDs := f.filterFailuresByTime(ctx, convFailures, force)
	if len(convIDs) == 0 {
		return
	}

	var fixed []chat1.ConversationID
	f.Debug(ctx, "retryThreadLoads: retrying %d conversations", len(convIDs))
	for _, convID := range convIDs {
		_, _, err := f.G().ConvSource.Pull(ctx, convID, uid, nil, &chat1.Pagination{
			Num: 50,
		})
		if err == nil {
			f.Debug(ctx, "retryThreadLoads: fixed convID: %s", convID)
			fixed = append(fixed, convID)
			if err := f.Success(ctx, convID, uid, types.ThreadLoad); err != nil {
				f.Debug(ctx, "retryThreadLoads: failure running Success: %s", err.Error())
			}
		} else {
			if err := box.Failure(ctx, convID); err != nil {
				f.Debug(ctx, "retryThreadLoads: failure running Failure: %s", err.Error())
			}
		}
	}

	f.Debug(ctx, "retryThreadLoads: sending %d stale notifications", len(fixed))
	f.G().ChatSyncer.SendChatStaleNotifications(ctx, uid, fixed, false)
}

func (f *FetchRetrier) retryOnce(uid gregor1.UID, force bool) {
	if f.IsOffline() {
		f.Debug(context.Background(), "retryOnce: currently offline, not attempting to fix errors")
	}

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		f.retryInboxLoads(uid, force)
		wg.Done()
	}()
	go func() {
		f.retryThreadLoads(uid, force)
		wg.Done()
	}()
	wg.Wait()
}
