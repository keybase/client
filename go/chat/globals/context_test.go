package globals

import (
	"context"
	"testing"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/errgroup"
)

func TestConcurrentContext(t *testing.T) {
	tc := externalstest.SetupTest(t, "Context", 1)
	defer tc.Cleanup()
	g := NewContext(tc.G, &ChatContext{
		CtxFactory: types.DummyCtxFactory{},
	})
	ctx := ChatCtx(context.TODO(), g, keybase1.TLFIdentifyBehavior_CHAT_CLI, nil, nil)
	convID := chat1.ConversationID([]byte("deadbeef"))
	eg := errgroup.Group{}
	for i := 0; i < 5; i++ {
		eg.Go(func() error {
			for j := 0; j < 50; j++ {
				CtxAddMessageCacheSkips(ctx, convID, []chat1.MessageUnboxed{
					// drop two empty msgs in
					{},
					{},
				})
			}
			return nil
		})
	}
	err := eg.Wait()
	require.NoError(t, err)
	res := CtxMessageCacheSkips(ctx)
	require.Len(t, res, 1)
	require.Len(t, res[0].Msgs, 5*50*2)
}
