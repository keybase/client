package commands

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type AddEmoji struct {
	*baseCommand
}

func NewAddEmoji(g *globals.Context) *AddEmoji {
	return &AddEmoji{
		baseCommand: newBaseCommand(g, "addemoji", "", "Add a custom emoji", false),
	}
}

func (h *AddEmoji) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string, replyTo *chat1.MessageID) (err error) {
	defer h.Trace(ctx, func() error { return err }, "AddEmoji")()
	if !h.Match(ctx, text) {
		return ErrInvalidCommand
	}
	defer func() {
		if err != nil {
			err := h.getChatUI().ChatCommandStatus(ctx, convID, "Failed to add emoji",
				chat1.UICommandStatusDisplayTyp_ERROR, nil)
			if err != nil {
				h.Debug(ctx, "Execute: error with command status: %+v", err)
			}
		} else {
			err := h.getChatUI().ChatCommandStatus(ctx, convID, "Emoji added successfully!",
				chat1.UICommandStatusDisplayTyp_STATUS, nil)
			if err != nil {
				h.Debug(ctx, "Execute: error with command status: %+v", err)
			}
		}
	}()
	toks, err := h.tokenize(text, 3)
	if err != nil {
		return err
	}
	_, err = h.G().EmojiSource.Add(ctx, uid, convID, toks[1], toks[2], nil)
	return err
}
