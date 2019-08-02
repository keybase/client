package commands

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Headline struct {
	*baseCommand
}

func NewHeadline(g *globals.Context) *Headline {
	return &Headline{
		baseCommand: newBaseCommand(g, "headline", "<description>",
			"Set the team channel topic", false, "topic"),
	}
}

func (s *Headline) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string, replyTo *chat1.MessageID) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Execute")()
	if !s.Match(ctx, text) {
		return ErrInvalidCommand
	}
	defer func() {
		if err != nil {
			s.getChatUI().ChatCommandStatus(ctx, convID, "Failed to set channel headline",
				chat1.UICommandStatusDisplayTyp_ERROR, nil)
		}
	}()
	_, msg, err := s.commandAndMessage(text)
	if err != nil {
		return err
	}
	conv, err := utils.GetVerifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return err
	}
	return s.G().ChatHelper.SendMsgByID(ctx, convID, tlfName,
		chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{
			Headline: msg,
		}), chat1.MessageType_HEADLINE, conv.Info.Visibility)
}
