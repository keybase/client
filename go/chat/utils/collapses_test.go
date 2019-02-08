package utils

import (
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestCollapses(t *testing.T) {
	tc := externalstest.SetupTest(t, "collapses", 0)
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	collapses := NewCollapses(g)

	ctx := context.TODO()
	convID := chat1.ConversationID([]byte{1, 2, 3, 4})
	uid := gregor1.UID([]byte{2, 3, 4, 5})

	require.NoError(t, collapses.ToggleSingle(ctx, uid, convID, 6, true))
	require.True(t, collapses.IsCollapsed(ctx, uid, convID, 6))
	require.NoError(t, collapses.ToggleSingle(ctx, uid, convID, 6, false))
	require.False(t, collapses.IsCollapsed(ctx, uid, convID, 6))

	require.NoError(t, collapses.ToggleRange(ctx, uid, convID, 10, true))
	require.True(t, collapses.IsCollapsed(ctx, uid, convID, 10))
	require.True(t, collapses.IsCollapsed(ctx, uid, convID, 2))
	require.False(t, collapses.IsCollapsed(ctx, uid, convID, 11))
	require.True(t, collapses.IsCollapsed(ctx, uid, convID, 6))
	require.NoError(t, collapses.ToggleSingle(ctx, uid, convID, 6, false))
	require.False(t, collapses.IsCollapsed(ctx, uid, convID, 6))
	require.NoError(t, collapses.ToggleRange(ctx, uid, convID, 10, false))
	require.False(t, collapses.IsCollapsed(ctx, uid, convID, 10))
	require.False(t, collapses.IsCollapsed(ctx, uid, convID, 2))
	require.False(t, collapses.IsCollapsed(ctx, uid, convID, 6))
}
