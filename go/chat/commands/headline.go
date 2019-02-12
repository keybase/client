package commands

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Headline struct {
	*baseCommand
}

func NewHeadline(g *globals.Context) *Headline {
	return &Headline{
		baseCommand: newBaseCommand(g, "headline", "<description>",
			"Set the team channel topic", "topic"),
	}
}

func (s *Headline) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Execute")()
	if !s.Match(ctx, text) {
		return ErrInvalidCommand
	}
	_, msg, err := s.commandAndMessage(text)
	if err != nil {
		return err
	}
	return s.G().ChatHelper.SendMsgByID(ctx, convID, tlfName,
		chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{
			Headline: msg,
		}), chat1.MessageType_HEADLINE)
}
