package globals

import (
	"context"
	"testing"
	"time"

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

func TestChatSessionContextCancelledOnLogout(t *testing.T) {
	c := &ChatContext{}
	ctx := c.SessionContext()
	require.NoError(t, ctx.Err())

	c.BeginChatLogout()
	require.ErrorIs(t, ctx.Err(), context.Canceled)
	require.ErrorIs(t, c.SessionContext().Err(), context.Canceled)

	c.PrepareChatSession()
	next := c.SessionContext()
	require.NoError(t, next.Err())
	// The logged-out context stays cancelled after the next session is prepared.
	require.ErrorIs(t, ctx.Err(), context.Canceled)

	c.MarkChatReady()
	require.NoError(t, c.SessionContext().Err())
}

func TestWithStopCancelsWhenParentStops(t *testing.T) {
	parent, cancel := context.WithCancel(context.Background())
	child := WithStop(context.WithValue(context.Background(), chatSessionKey, uint64(3)), parent)
	require.NoError(t, child.Err())
	epoch, ok := ctxChatSession(child)
	require.True(t, ok)
	require.Equal(t, uint64(3), epoch)

	cancel()
	select {
	case <-child.Done():
	case <-time.After(time.Second):
		require.Fail(t, "child was not cancelled")
	}
	require.ErrorIs(t, child.Err(), context.Canceled)
}
