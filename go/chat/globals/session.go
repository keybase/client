package globals

import (
	"context"

	"github.com/keybase/client/go/libkb"
)

type (
	chatSessionKeyTyp int
)

var chatSessionKey chatSessionKeyTyp

func chatSessionNotReadyErr() error {
	return libkb.NewLoginRequiredError("chat session not ready")
}

// Chat session gate: account switch is a logout barrier + login barrier.
// Zero value is ready so unit tests that never login still work. The service
// calls BeginChatLogout, then PrepareChatSession before the next account's
// modules start, then MarkChatReady once they are up.
//
// BeginChatLogout also cancels the session context. Background work parented
// on it (see BackgroundChatCtx) returns instead of holding Stop.

func (c *ChatContext) BeginChatLogout() {
	c.sessionMu.Lock()
	defer c.sessionMu.Unlock()
	c.sessionEpoch++
	c.sessionBlocked = true
	c.cancelSessionLocked()
	// Keep a cancelled context so work started before PrepareChatSession
	// observes logout instead of lazily attaching to a live one.
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	c.sessionCtx = cancelled
}

// PrepareChatSession installs a live context for the next account's background
// work. The session stays blocked until MarkChatReady.
func (c *ChatContext) PrepareChatSession() {
	c.sessionMu.Lock()
	defer c.sessionMu.Unlock()
	c.cancelSessionLocked()
	c.sessionCtx, c.sessionCancel = context.WithCancel(context.Background())
}

func (c *ChatContext) MarkChatReady() {
	c.sessionMu.Lock()
	defer c.sessionMu.Unlock()
	c.sessionEpoch++
	c.sessionBlocked = false
	if c.sessionCtx == nil || c.sessionCtx.Err() != nil {
		c.sessionCtx, c.sessionCancel = context.WithCancel(context.Background())
	}
}

func (c *ChatContext) cancelSessionLocked() {
	if c.sessionCancel != nil {
		c.sessionCancel()
		c.sessionCancel = nil
	}
}

// SessionContext is the parent of background chat work for this account.
// Cancelled by BeginChatLogout.
func (c *ChatContext) SessionContext() context.Context {
	c.sessionMu.Lock()
	defer c.sessionMu.Unlock()
	if c.sessionCtx == nil {
		c.sessionCtx, c.sessionCancel = context.WithCancel(context.Background())
	}
	return c.sessionCtx
}

func (c *ChatContext) chatSessionSnapshot() (epoch uint64, ready bool) {
	c.sessionMu.Lock()
	defer c.sessionMu.Unlock()
	return c.sessionEpoch, !c.sessionBlocked
}

func (c *ChatContext) ChatSessionReady() bool {
	_, ready := c.chatSessionSnapshot()
	return ready
}

func (c *ChatContext) AssertChatSessionReady() error {
	if c.ChatSessionReady() {
		return nil
	}
	return chatSessionNotReadyErr()
}

func CtxStampChatSession(ctx context.Context, g *Context) context.Context {
	epoch, _ := g.chatSessionSnapshot()
	return context.WithValue(ctx, chatSessionKey, epoch)
}

func BindChatSession(ctx context.Context, g *Context) (context.Context, error) {
	epoch, ready := g.chatSessionSnapshot()
	if !ready {
		return ctx, chatSessionNotReadyErr()
	}
	return context.WithValue(ctx, chatSessionKey, epoch), nil
}

func ctxChatSession(ctx context.Context) (uint64, bool) {
	epoch, ok := ctx.Value(chatSessionKey).(uint64)
	return epoch, ok
}

func ChatSessionStale(ctx context.Context, g *Context) bool {
	stamp, ok := ctxChatSession(ctx)
	if !ok {
		return !g.ChatSessionReady()
	}
	epoch, ready := g.chatSessionSnapshot()
	return !ready || stamp != epoch
}
