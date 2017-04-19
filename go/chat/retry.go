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
	"github.com/keybase/clockwork"
	context "golang.org/x/net/context"
)

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
		forceCh:      make(chan struct{}),
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
	defer f.Trace(ctx, func() error { return nil }, "Reconnect")()
	f.Lock()
	f.offline = false
	f.Unlock()
	select {
	case f.forceCh <- struct{}{}:
	default:
	}
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
		case <-f.clock.After(time.Second * 3):
			f.retryOnce(uid)
		case <-f.forceCh:
			f.retryOnce(uid)
		case cb := <-f.shutdownCh:
			defer close(cb)
			return
		}
	}
}

func (f *FetchRetrier) retryInboxLoads(uid gregor1.UID) {
	var err error
	box := storage.NewConversationFailureBox(f.G(), uid, f.boxKey(types.InboxLoad))
	ctx := context.Background()

	var convIDs []chat1.ConversationID
	convIDs, err = box.Read(ctx)
	if err != nil {
		f.Debug(ctx, "retryInboxLoads: failed to read failure box, giving up: %s", err.Error())
		return
	}

	// Reload these all conversations and hope they work
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
		}
	}

	f.Debug(ctx, "retryInboxLoads: sending %d stale notifications", len(fixed))
	f.G().ChatSyncer.SendChatStaleNotifications(ctx, uid, fixed, false)
}

func (f *FetchRetrier) retryThreadLoads(uid gregor1.UID) {
	var err error
	box := storage.NewConversationFailureBox(f.G(), uid, f.boxKey(types.ThreadLoad))
	ctx := context.Background()

	var convIDs []chat1.ConversationID
	convIDs, err = box.Read(ctx)
	if err != nil {
		f.Debug(ctx, "retryThreadLoads: failed to read failure box, giving up: %s", err.Error())
		return
	}

	var fixed []chat1.ConversationID
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
		}
	}

	f.Debug(ctx, "retryThreadLoads: sending %d stale notifications", len(fixed))
	f.G().ChatSyncer.SendChatStaleNotifications(ctx, uid, fixed, false)
}

func (f *FetchRetrier) retryOnce(uid gregor1.UID) {
	if f.IsOffline() {
		f.Debug(context.Background(), "retryOnce: currently offline, not attempting to fix errors")
	}

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		f.retryInboxLoads(uid)
		wg.Done()
	}()
	go func() {
		f.retryThreadLoads(uid)
		wg.Done()
	}()
	wg.Wait()
}
