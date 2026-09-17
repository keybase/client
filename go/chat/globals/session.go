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
// calls BeginChatLogout / MarkChatReady around stop/start of chat modules.
func (c *ChatContext) setChatSession(blocked bool) {
	c.sessionMu.Lock()
	defer c.sessionMu.Unlock()
	c.sessionEpoch++
	c.sessionBlocked = blocked
}

func (c *ChatContext) BeginChatLogout() {
	c.setChatSession(true)
}

func (c *ChatContext) MarkChatReady() {
	c.setChatSession(false)
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
