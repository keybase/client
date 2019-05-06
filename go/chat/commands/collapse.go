package commands

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Collapse struct {
	*baseCommand
}

func NewCollapse(g *globals.Context) *Collapse {
	return &Collapse{
		baseCommand: newBaseCommand(g, "collapse", "", "Collapse all inline previews", false),
	}
}

func (h *Collapse) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string, replyTo *chat1.MessageID) (err error) {
	defer h.Trace(ctx, func() error { return err }, "Collapse")()
	if !h.Match(ctx, text) {
		return ErrInvalidCommand
	}
	conv, err := getConvByID(ctx, h.G(), uid, convID)
	if err != nil {
		return err
	}
	maxMsgID := conv.Conv.ReaderInfo.MaxMsgid
	if err := utils.NewCollapses(h.G()).ToggleRange(ctx, uid, convID, maxMsgID, true); err != nil {
		return err
	}
	h.G().ActivityNotifier.ThreadsStale(ctx, uid, []chat1.ConversationStaleUpdate{
		chat1.ConversationStaleUpdate{
			ConvID:     convID,
			UpdateType: chat1.StaleUpdateType_NEWACTIVITY,
		},
	})
	return nil
}
