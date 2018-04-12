package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func setupLoaderTest(t *testing.T) (*kbtest.ChatTestContext, *kbtest.ChatMockWorld, *chatListener, chat1.NewConversationRemoteRes) {
	ctx, world, ri, _, baseSender, listener := setupTest(t, 1)

	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]
	trip := newConvTriple(ctx, t, tc, u.Username)
	firstMessagePlaintext := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TLFNAME,
		},
		MessageBody: chat1.MessageBody{},
	}
	firstMessageBoxed, _, _, _, _, err := baseSender.Prepare(ctx, firstMessagePlaintext,
		chat1.ConversationMembersType_KBFS, nil)
	require.NoError(t, err)
	res, err := ri.NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
		IdTriple:   trip,
		TLFMessage: *firstMessageBoxed,
	})
	require.NoError(t, err)
	return tc, world, listener, res
}

func TestConvLoader(t *testing.T) {
	tc, world, listener, res := setupLoaderTest(t)
	defer world.Cleanup()

	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(),
		types.NewConvLoaderJob(res.ConvID, nil, nil)))
	select {
	case convID := <-listener.bgConvLoads:
		if !convID.Eq(res.ConvID) {
			t.Errorf("loaded conv id: %s, expected %s", convID, res.ConvID)
		}
	case <-time.After(20 * time.Second):
		t.Fatal("timeout waiting for conversation load")
	}
}

type slowestRemote struct {
	chat1.RemoteInterface
	callCh chan struct{}
}

func makeSlowestRemote() slowestRemote {
	return slowestRemote{
		callCh: make(chan struct{}, 5),
	}
}

func (s slowestRemote) delay(ctx context.Context) {
	s.callCh <- struct{}{}
	select {
	case <-ctx.Done():
	case <-time.After(24 * time.Hour):
	}
}

func (s slowestRemote) GetThreadRemote(ctx context.Context, arg chat1.GetThreadRemoteArg) (res chat1.GetThreadRemoteRes, err error) {
	s.delay(ctx)
	return res, context.Canceled
}

func (s slowestRemote) GetMessagesRemote(ctx context.Context, arg chat1.GetMessagesRemoteArg) (res chat1.GetMessagesRemoteRes, err error) {
	s.delay(ctx)
	return res, context.Canceled
}

func TestConvLoaderSuspend(t *testing.T) {
	tc, world, listener, res := setupLoaderTest(t)
	defer world.Cleanup()

	ri := tc.ChatG.ConvSource.(*HybridConversationSource).ri
	slowRi := makeSlowestRemote()
	tc.ChatG.ConvSource.(*HybridConversationSource).ri = func() chat1.RemoteInterface {
		return slowRi
	}
	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(),
		types.NewConvLoaderJob(res.ConvID, nil, nil)))
	select {
	case <-slowRi.callCh:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no remote call")
	}
	require.True(t, tc.Context().ConvLoader.Suspend(context.TODO()))
	select {
	case <-listener.bgConvLoads:
		require.Fail(t, "no load yet")
	default:
	}
	require.True(t, tc.Context().ConvLoader.Suspend(context.TODO()))

	tc.ChatG.ConvSource.(*HybridConversationSource).ri = ri
	require.False(t, tc.Context().ConvLoader.Resume(context.TODO()))
	select {
	case <-listener.bgConvLoads:
		require.Fail(t, "no load yet")
	default:
	}
	require.True(t, tc.Context().ConvLoader.Resume(context.TODO()))
	select {
	case convID := <-listener.bgConvLoads:
		require.Equal(t, res.ConvID, convID)
	case <-time.After(20 * time.Second):
		require.Fail(t, "no event")
	}
}

func TestConvLoaderAppState(t *testing.T) {
	tc, world, listener, res := setupLoaderTest(t)
	defer world.Cleanup()

	clock := clockwork.NewFakeClock()
	appStateCh := make(chan struct{})
	tc.ChatG.ConvLoader.(*BackgroundConvLoader).clock = clock
	tc.ChatG.ConvLoader.(*BackgroundConvLoader).appStateCh = appStateCh
	ri := tc.ChatG.ConvSource.(*HybridConversationSource).ri
	slowRi := makeSlowestRemote()
	failDuration := 20 * time.Second
	uid := gregor1.UID(tc.G.Env.GetUID().ToBytes())

	// Test that a foreground with no background doesnt do anything
	tc.ChatG.ConvSource.(*HybridConversationSource).ri = func() chat1.RemoteInterface {
		return slowRi
	}
	tc.ChatG.ConvSource.(*HybridConversationSource).Clear(res.ConvID, uid)
	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(),
		types.NewConvLoaderJob(res.ConvID, nil, nil)))
	clock.BlockUntil(1)
	clock.Advance(200 * time.Millisecond) // Get by small sleep
	select {
	case <-slowRi.callCh:
	case <-time.After(failDuration):
		require.Fail(t, "no remote call")
	}
	require.True(t, tc.Context().ConvLoader.Suspend(context.TODO()))
	tc.G.AppState.Update(keybase1.AppState_FOREGROUND)
	select {
	case <-appStateCh:
		require.Fail(t, "no app state")
	default:
	}
	select {
	case <-listener.bgConvLoads:
		require.Fail(t, "no load yet")
	default:
	}
	tc.ChatG.ConvSource.(*HybridConversationSource).ri = ri
	require.True(t, tc.Context().ConvLoader.Resume(context.TODO()))
	clock.BlockUntil(1)
	clock.Advance(2 * time.Second) // Get by resume wait
	clock.BlockUntil(1)
	clock.Advance(time.Hour) // Get by small sleep
	select {
	case convID := <-listener.bgConvLoads:
		require.Equal(t, res.ConvID, convID)
	case <-time.After(failDuration):
		require.Fail(t, "no event")
	}

	t.Logf("testing foreground/background")
	// Test that background/foreground works
	tc.ChatG.ConvSource.(*HybridConversationSource).Clear(res.ConvID, uid)
	tc.ChatG.ConvSource.(*HybridConversationSource).ri = func() chat1.RemoteInterface {
		return slowRi
	}
	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(),
		types.NewConvLoaderJob(res.ConvID, nil, nil)))
	clock.BlockUntil(1)
	clock.Advance(200 * time.Millisecond) // Get by small sleep
	select {
	case <-slowRi.callCh:
	case <-time.After(failDuration):
		require.Fail(t, "no remote call")
	}
	tc.G.AppState.Update(keybase1.AppState_BACKGROUND)
	select {
	case <-appStateCh:
	case <-time.After(failDuration):
		require.Fail(t, "no app state")
	}
	tc.ChatG.ConvSource.(*HybridConversationSource).ri = ri
	tc.G.AppState.Update(keybase1.AppState_FOREGROUND)
	select {
	case <-appStateCh:
	case <-time.After(failDuration):
		require.Fail(t, "no app state")
	}
	// Need to advance clock
	select {
	case <-listener.bgConvLoads:
		require.Fail(t, "no load yet")
	default:
	}
	clock.BlockUntil(1)
	clock.Advance(10 * time.Second)
	clock.BlockUntil(1)
	clock.Advance(time.Hour) // Get by small sleep
	select {
	case convID := <-listener.bgConvLoads:
		require.Equal(t, res.ConvID, convID)
	case <-time.After(failDuration):
		require.Fail(t, "no event")
	}

}
