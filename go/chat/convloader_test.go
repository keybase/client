package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
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

	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(), res.ConvID))
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

func (s slowestRemote) GetThreadRemote(ctx context.Context, arg chat1.GetThreadRemoteArg) (res chat1.GetThreadRemoteRes, err error) {
	s.callCh <- struct{}{}
	select {
	case <-ctx.Done():
	case <-time.After(24 * time.Hour):
	}
	return res, nil
}

func TestConvLoaderSuspend(t *testing.T) {
	tc, world, listener, res := setupLoaderTest(t)
	defer world.Cleanup()

	ri := tc.ChatG.ConvSource.(*HybridConversationSource).ri
	slowRi := makeSlowestRemote()
	tc.ChatG.ConvSource.(*HybridConversationSource).ri = func() chat1.RemoteInterface {
		return slowRi
	}
	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(), res.ConvID))
	select {
	case <-slowRi.callCh:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no remote call")
	}
	require.True(t, tc.Context().ConvLoader.Suspend(context.TODO()))

	tc.ChatG.ConvSource.(*HybridConversationSource).ri = ri
	tc.Context().ConvLoader.Resume(context.TODO())
	select {
	case convID := <-listener.bgConvLoads:
		require.Equal(t, res.ConvID, convID)
	case <-time.After(20 * time.Second):
		require.Fail(t, "no event")
	}
}
