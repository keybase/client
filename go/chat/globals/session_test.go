package globals

import (
	"context"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestChatSessionGate(t *testing.T) {
	c := &ChatContext{}
	g := &Context{ChatContext: c}
	require.True(t, c.ChatSessionReady())
	require.NoError(t, c.AssertChatSessionReady())

	c.BeginChatLogout()
	require.False(t, c.ChatSessionReady())
	err := c.AssertChatSessionReady()
	require.Error(t, err)
	_, ok := err.(libkb.LoginRequiredError)
	require.True(t, ok)
	_, err = BindChatSession(context.Background(), g)
	require.Error(t, err)

	ctx := CtxStampChatSession(context.Background(), g)
	require.True(t, ChatSessionStale(ctx, g))

	c.MarkChatReady()
	require.True(t, c.ChatSessionReady())
	ctx2, err := BindChatSession(context.Background(), g)
	require.NoError(t, err)
	require.False(t, ChatSessionStale(ctx2, g))
	require.True(t, ChatSessionStale(ctx, g), "old epoch must be stale after login")
}
