package commands

import (
	"context"
	"errors"
	"sync"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Location struct {
	*baseCommand
	sync.Mutex
	displayed bool
}

func NewLocation(g *globals.Context) *Location {
	return &Location{
		baseCommand: newBaseCommand(g, "location", "", "Post your current location", true),
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
			Body:  "_Sharing my location (using /location)..._",
			Coord: &coord,
		}), chat1.MessageType_TEXT, nil, replyTo); err != nil {
		return err
	}
	return nil
}

func (h *Location) Preview(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) {
	h.Lock()
	defer h.Unlock()
	defer h.Trace(ctx, func() error { return nil }, "Preview")()
	if !h.Match(ctx, text) {
		if h.displayed {
			h.getChatUI().ChatCommandMarkdown(ctx, convID, nil)
			h.displayed = false
		}
		return
	}
	h.getChatUI().ChatCommandMarkdown(ctx, convID, &chat1.UICommandMarkdown{
		Body:  utils.DecorateWithLinks(ctx, utils.EscapeForDecorate(ctx, locationUsage)),
		Title: &locationTitle,
	})
	h.displayed = true
}

var locationTitle = `*/location*`

var locationUsage = `Location posts consist of your current location coordinate, and a map rendered through the use of Google Maps. We take care to guard your privacy: https://keybase.io/docs/chat/location

- The location sender obtains the map from Google without using their IP address directly. The map is then sent as an encrypted attachment into the conversation.
- Other members in the conversation obtain the map as an encrypted attachment, and never talk to Google at all.`
