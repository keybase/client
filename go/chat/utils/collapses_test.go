package utils

import (
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestCollapses(t *testing.T) {
	tc := externalstest.SetupTest(t, "collapses", 0)
	defer tc.Cleanup()

	g := globals.NewContext(tc.G, &globals.ChatContext{})
	collapses := NewCollapses(g)

	ctx := context.TODO()
	convID := chat1.ConversationID([]byte{1, 2, 3, 4})
	uid := gregor1.UID([]byte{2, 3, 4, 5})
	clock := clockwork.NewFakeClock()
	collapses.clock = clock

	require.NoError(t, collapses.ToggleSingle(ctx, uid, convID, 6, true))
	require.True(t, collapses.IsCollapsed(ctx, uid, convID, 6, chat1.MessageType_ATTACHMENT))
	require.NoError(t, collapses.ToggleSingle(ctx, uid, convID, 6, false))
	require.False(t, collapses.IsCollapsed(ctx, uid, convID, 6, chat1.MessageType_ATTACHMENT))

	require.NoError(t, collapses.ToggleRange(ctx, uid, convID, 10, true))
	clock.Advance(10 * time.Second)
	require.True(t, collapses.IsCollapsed(ctx, uid, convID, 10, chat1.MessageType_ATTACHMENT))
	require.True(t, collapses.IsCollapsed(ctx, uid, convID, 2, chat1.MessageType_UNFURL))
	require.False(t, collapses.IsCollapsed(ctx, uid, convID, 11, chat1.MessageType_ATTACHMENT))
	require.True(t, collapses.IsCollapsed(ctx, uid, convID, 6, chat1.MessageType_ATTACHMENT))
	require.NoError(t, collapses.ToggleSingle(ctx, uid, convID, 6, false))
	clock.Advance(10 * time.Second)
	require.False(t, collapses.IsCollapsed(ctx, uid, convID, 6, chat1.MessageType_ATTACHMENT))
	require.NoError(t, collapses.ToggleRange(ctx, uid, convID, 10, false))
	clock.Advance(10 * time.Second)
	require.False(t, collapses.IsCollapsed(ctx, uid, convID, 10, chat1.MessageType_ATTACHMENT))
	require.False(t, collapses.IsCollapsed(ctx, uid, convID, 2, chat1.MessageType_ATTACHMENT))
	require.False(t, collapses.IsCollapsed(ctx, uid, convID, 6, chat1.MessageType_ATTACHMENT))
}
