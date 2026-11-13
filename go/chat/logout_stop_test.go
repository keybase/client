package chat

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-codec/codec"
	"github.com/stretchr/testify/require"
)

// Logout waits on each chat module's Stop before the next account can log in,
// so Stop must cancel work it already has in flight rather than wait it out:
// one slow server call otherwise holds up the whole account switch.

// blockingInboxSource stands in for inbox work the server is slow to answer:
// each blocking call returns only once its context is cancelled or the test
// releases it.
type blockingInboxSource struct {
	types.InboxSource
	entered, cancelled, release        chan struct{}
	enterOnce, cancelOnce, releaseOnce sync.Once
}

func newBlockingInboxSource() *blockingInboxSource {
	return &blockingInboxSource{
		entered:   make(chan struct{}),
		cancelled: make(chan struct{}),
		release:   make(chan struct{}),
	}
}

func (s *blockingInboxSource) block(ctx context.Context) error {
	s.enterOnce.Do(func() { close(s.entered) })
	select {
	case <-ctx.Done():
		s.cancelOnce.Do(func() { close(s.cancelled) })
		return ctx.Err()
	case <-s.release:
		return errors.New("released by test")
	}
}

func (s *blockingInboxSource) releaseAll() {
	s.releaseOnce.Do(func() { close(s.release) })
}

func (s *blockingInboxSource) waitEntered(t *testing.T) {
	select {
	case <-s.entered:
	case <-time.After(10 * time.Second):
		require.Fail(t, "work never reached the inbox source")
	}
}

// requireCancelledBy fails unless stopped closes promptly and the blocked call
// returned because its context was cancelled.
func (s *blockingInboxSource) requireCancelledBy(t *testing.T, stopped chan struct{}) {
	select {
	case <-stopped:
	case <-time.After(2 * time.Second):
		require.Fail(t, "Stop waited on the in-flight call instead of cancelling it")
	}
	select {
	case <-s.cancelled:
	default:
		require.Fail(t, "Stop returned but the in-flight call was never cancelled")
	}
}

func (s *blockingInboxSource) GetInboxQueryLocalToRemote(context.Context,
	*chat1.GetInboxLocalQuery,
) (*chat1.GetInboxQuery, types.NameInfo, error) {
	return &chat1.GetInboxQuery{}, types.NameInfo{}, nil
}

func (s *blockingInboxSource) ReadUnverified(ctx context.Context, _ gregor1.UID,
	_ types.InboxSourceDataSourceTyp, _ *chat1.GetInboxQuery,
) (types.Inbox, error) {
	return types.Inbox{}, s.block(ctx)
}

func (s *blockingInboxSource) TlfFinalize(ctx context.Context, _ gregor1.UID, _ chat1.InboxVers,
	_ []chat1.ConversationID, _ chat1.ConversationFinalizeInfo,
) ([]chat1.ConversationLocal, error) {
	return nil, s.block(ctx)
}

func setupLogoutStopTest(t *testing.T, name string) (libkb.TestContext, *globals.Context, *blockingInboxSource) {
	tc := libkb.SetupTest(t, name, 0)
	tc.G.ConnectionManager = libkb.NewConnectionManager()
	tc.G.UIRouter = kbtest.NewMockUIRouter(kbtest.NewChatUI())
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	g.CtxFactory = NewCtxFactory(g)
	src := newBlockingInboxSource()
	g.InboxSource = src
	return tc, g, src
}

// beginLogout runs the steps Service#OnLogout takes before stopping chat modules.
func beginLogout(tc libkb.TestContext, g *globals.Context) {
	g.BeginChatLogout()
	tc.G.RPCCanceler.CancelLiveContexts(libkb.RPCCancelerReasonLogout)
}

func TestUIInboxLoaderStopCancelsInflightLayoutFetch(t *testing.T) {
	tc, g, src := setupLogoutStopTest(t, "TestUIInboxLoaderStopCancelsInflightLayoutFetch")
	defer tc.Cleanup()

	ctx := context.TODO()
	loader := NewUIInboxLoader(g)
	loader.Start(ctx, gregor1.UID([]byte("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")))
	var stopped chan struct{}
	defer func() {
		src.releaseAll()
		if stopped == nil {
			stopped = loader.Stop(ctx)
		}
		<-stopped
	}()

	loader.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "test")
	src.waitEntered(t)

	beginLogout(tc, g)
	stopped = loader.Stop(ctx)
	src.requireCancelledBy(t, stopped)
}

func TestPushHandlerStopCancelsInflightHandler(t *testing.T) {
	tc, g, src := setupLogoutStopTest(t, "TestPushHandlerStopCancelsInflightHandler")
	defer tc.Cleanup()

	ctx := context.TODO()
	ph := NewPushHandler(g)
	ph.Start(ctx, nil)
	var stopped chan struct{}
	defer func() {
		src.releaseAll()
		if stopped == nil {
			stopped = ph.Stop(ctx)
		}
		<-stopped
	}()

	var data []byte
	enc := codec.NewEncoderBytes(&data, &codec.MsgpackHandle{WriteExt: true})
	require.NoError(t, enc.Encode(chat1.TLFFinalizeUpdate{InboxVers: 1}))
	require.NoError(t, ph.TlfFinalize(ctx, gregor1.OutOfBandMessage{
		Uid_:    gregor1.UID([]byte("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")),
		System_: types.PushTLFFinalize,
		Body_:   data,
	}))
	src.waitEntered(t)

	beginLogout(tc, g)
	stopped = ph.Stop(ctx)
	src.requireCancelledBy(t, stopped)
}

// A Start right after a Stop, before the stop's wait on the work group has returned, must wait for
// it: starting the work group again while it is being waited on panics ("WaitGroup is reused
// before previous Wait has returned"). Back-to-back account switches do exactly this.
func TestUIInboxLoaderStartWaitsForPreviousStop(t *testing.T) {
	tc, g, _ := setupLogoutStopTest(t, "TestUIInboxLoaderStartWaitsForPreviousStop")
	defer tc.Cleanup()

	ctx := context.TODO()
	loader := NewUIInboxLoader(g)
	release, stopped := holdUIInboxLoaderStop(ctx, loader)

	started := make(chan struct{})
	go func() {
		loader.Start(ctx, gregor1.UID([]byte("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")))
		close(started)
	}()
	select {
	case <-started:
		t.Fatal("Start returned while the previous Stop was still waiting on the work group")
	case <-time.After(200 * time.Millisecond):
	}

	release()
	<-stopped
	requireDone(t, started, "Start did not return once the previous Stop finished")
	<-loader.Stop(ctx)
}

// Holds the loader's previous stop pending: the returned func lets it finish.
func holdUIInboxLoaderStop(ctx context.Context, loader *UIInboxLoader) (release func(), stopped chan struct{}) {
	loader.Start(ctx, gregor1.UID([]byte("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")))
	ch := make(chan struct{})
	loader.eg.Go(func() error {
		<-ch
		return nil
	})
	return func() { close(ch) }, loader.Stop(ctx)
}

func requireDone(t *testing.T, ch chan struct{}, what string) {
	select {
	case <-ch:
	case <-time.After(5 * time.Second):
		t.Fatal(what)
	}
}

// Two Starts waiting on the same pending stop: only the later one starts the loader, so the
// earlier one's loops are not left running with nothing to stop them.
func TestUIInboxLoaderLaterStartWinsAfterPendingStop(t *testing.T) {
	tc, g, _ := setupLogoutStopTest(t, "TestUIInboxLoaderLaterStartWinsAfterPendingStop")
	defer tc.Cleanup()

	ctx := context.TODO()
	loader := NewUIInboxLoader(g)
	release, stopped := holdUIInboxLoaderStop(ctx, loader)
	uidB := gregor1.UID([]byte("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"))
	uidC := gregor1.UID([]byte("cccccccccccccccccccccccccccccccc"))
	startedB, startedC := make(chan struct{}), make(chan struct{})
	go func() {
		loader.Start(ctx, uidB)
		close(startedB)
	}()
	time.Sleep(100 * time.Millisecond)
	go func() {
		loader.Start(ctx, uidC)
		close(startedC)
	}()
	time.Sleep(100 * time.Millisecond)
	release()
	<-stopped
	requireDone(t, startedB, "the first Start did not return")
	requireDone(t, startedC, "the second Start did not return")

	loader.Lock()
	uid := loader.uid
	loader.Unlock()
	require.Equal(t, uidC, uid)
	// a single Stop ends every loop: none was left over from the superseded Start
	requireDone(t, loader.Stop(ctx), "Stop did not finish: loops from a superseded Start are still running")
}

// A Stop that comes while a Start waits on the previous stop wins: the Start gives up.
func TestUIInboxLoaderStopSupersedesWaitingStart(t *testing.T) {
	tc, g, _ := setupLogoutStopTest(t, "TestUIInboxLoaderStopSupersedesWaitingStart")
	defer tc.Cleanup()

	ctx := context.TODO()
	loader := NewUIInboxLoader(g)
	release, _ := holdUIInboxLoaderStop(ctx, loader)
	started := make(chan struct{})
	go func() {
		loader.Start(ctx, gregor1.UID([]byte("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")))
		close(started)
	}()
	time.Sleep(100 * time.Millisecond)
	stopped := loader.Stop(ctx)
	release()
	requireDone(t, stopped, "Stop did not finish")
	requireDone(t, started, "Start did not return")

	loader.Lock()
	defer loader.Unlock()
	require.False(t, loader.started)
}
