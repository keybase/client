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
