package commands

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Shrug struct {
	*baseCommand
}

func NewShrug(g *globals.Context) *Shrug {
	return &Shrug{
		baseCommand: newBaseCommand(g, "shrug", ""),
	}
}

func (s *Shrug) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Execute")()
	if !s.Match(ctx, text) {
		return ErrInvalidCommand
	}
	return s.G().ChatHelper.SendTextByIDNonblock(ctx, convID, tlfName, `¯\_(ツ)_/¯`)
}
