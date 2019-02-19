package commands

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Flip struct {
	*baseCommand
}

func NewFlip(g *globals.Context) *Flip {
	return &Flip{
		baseCommand: newBaseCommand(g, "flip", "", "Flip a cryptographic coin"),
	}
}

func (s *Flip) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Execute")()
	if !s.Match(ctx, text) {
		return ErrInvalidCommand
	}
	return s.G().CoinFlipManager.StartFlip(ctx, uid, convID, tlfName, text)
}
