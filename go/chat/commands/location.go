package commands

import (
	"context"
	"errors"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Location struct {
	*baseCommand
}

func NewLocation(g *globals.Context) *Location {
	return &Location{
		baseCommand: newBaseCommand(g, "location", "", "Post your current location", false),
	}
}

func (n nullChatUI) ChatGetCoordinate(ctx context.Context) (chat1.Coordinate, error) {
	return chat1.Coordinate{}, errors.New("no UI available")
}

func (h *Location) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string, replyTo *chat1.MessageID) (err error) {
	defer h.Trace(ctx, func() error { return err }, "Location")()
	if !h.Match(ctx, text) {
		return ErrInvalidCommand
	}
	coord, err := h.getChatUI().ChatGetCoordinate(ctx)
	if err != nil {
		return err
	}
	if _, err := h.G().ChatHelper.SendMsgByIDNonblock(ctx, convID, tlfName,
		chat1.NewMessageBodyWithText(chat1.MessageText{
			Body:  "_Sharing my location..._",
			Coord: &coord,
		}), chat1.MessageType_TEXT, nil, replyTo); err != nil {
		return err
	}
	return nil
}
