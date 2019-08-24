package commands

import (
	"context"
	"errors"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Mute struct {
	*baseCommand
}

func NewMute(g *globals.Context) *Mute {
	return &Mute{
		baseCommand: newBaseCommand(g, "mute", "", "Mute the current conversation", false, "shh"),
	}
}

func (h *Mute) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string, replyTo *chat1.MessageID) (err error) {
	defer h.Trace(ctx, func() error { return err }, "Mute")()
	if !h.Match(ctx, text) {
		return ErrInvalidCommand
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
		return errors.New("no conversation found")
	}
	status := chat1.ConversationStatus_MUTED
	if ib.Convs[0].Info.Status == chat1.ConversationStatus_MUTED {
		status = chat1.ConversationStatus_UNFILED
	}
	return h.G().InboxSource.RemoteSetConversationStatus(ctx, uid, convID, status)
}
