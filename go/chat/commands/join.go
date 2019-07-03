package commands

import (
	"context"
	"errors"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Join struct {
	*baseCommand
}

func NewJoin(g *globals.Context) *Join {
	return &Join{
		baseCommand: newBaseCommand(g, "join", "", "Join a team channel", false),
	}
}

func (h *Join) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string, replyTo *chat1.MessageID) (err error) {
	defer h.Trace(ctx, func() error { return err }, "Join")()
	if !h.Match(ctx, text) {
		return ErrInvalidCommand
	}
	ui, err := h.G().UIRouter.GetChatUI()
	if err != nil {
		return err
	}
	ib, _, err := h.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil,
		&chat1.GetInboxLocalQuery{
			ConvIDs: []chat1.ConversationID{convID},
		}, nil)
	if err != nil {
		return err
	}
	if len(ib.Convs) == 0 {
		return errors.New("conv not found")
	}
	ui.ChatShowManageChannels(ctx, ib.Convs[0].Info.TlfName)
	return nil
}
