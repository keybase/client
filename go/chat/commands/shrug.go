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
		baseCommand: newBaseCommand(g, "shrug", "", `Appends ¯\_(ツ)_/¯ to your message`, false),
	}
}

func (s *Shrug) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string, replyTo *chat1.MessageID) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Execute")()
	if !s.Match(ctx, text) {
		return ErrInvalidCommand
	}
	_, msg, err := s.commandAndMessage(text)
	if err != nil {
		return err
	}
	res := `¯\_(ツ)_/¯`
	if len(msg) > 0 {
		res = msg + " " + res
	}
	_, err = s.G().ChatHelper.SendTextByIDNonblock(ctx, convID, tlfName, res, nil, replyTo)
	return err
}
