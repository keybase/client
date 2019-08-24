package commands

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Leave struct {
	*baseCommand
}

func NewLeave(g *globals.Context) *Leave {
	return &Leave{
		baseCommand: newBaseCommand(g, "leave", "", "Leave the current team channel", false),
	}
}

func (h *Leave) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string, replyTo *chat1.MessageID) (err error) {
	defer h.Trace(ctx, func() error { return err }, "Leave")()
	if !h.Match(ctx, text) {
		return ErrInvalidCommand
	}
	return h.G().ChatHelper.LeaveConversation(ctx, uid, convID)
}
