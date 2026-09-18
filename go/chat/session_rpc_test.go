package chat

import (
	"context"
	"testing"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func TestInboxLoaderRejectsUntilReady(t *testing.T) {
	ctc := makeChatTestContext(t, "TestInboxLoaderRejectsUntilReady", 1)
	defer ctc.cleanup()
	users := ctc.users()
	h := ctc.as(t, users[0]).h
	tc := ctc.world.Tcs[users[0].Username]
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	loader := NewUIInboxLoader(tc.Context())
	tc.ChatG.UIInboxLoader = loader
	loader.Start(context.Background(), uid)
	defer func() { <-loader.Stop(context.Background()) }()

	// Unstamped ctx: stale iff ChatSessionReady is false, independent of setup stamps.
	ctx := context.Background()
	h.G().BeginChatLogout()
	err := loader.UpdateConvs(ctx, []chat1.ConversationID{{0x01}})
	require.Error(t, err)
	require.ErrorAs(t, err, new(storage.AbortedError))

	h.G().MarkChatReady()
	_, err = loader.sessionUID(ctx)
	require.NoError(t, err)
}
