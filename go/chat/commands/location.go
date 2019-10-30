package commands

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
)

type Location struct {
	*baseCommand
	sync.Mutex
	displayed bool
	clock     clockwork.Clock
}

func NewLocation(g *globals.Context) *Location {
	return &Location{
		baseCommand: newBaseCommand(g, "location", "", "Post your current location", true),
		clock:       clockwork.NewRealClock(),
	}
}

func (h *Location) SetClock(clock clockwork.Clock) {
	h.clock = clock
}

func (h *Location) isLiveLocation(toks []string) *gregor1.Time {
	if len(toks) != 3 {
		return nil
	}
	if toks[1] != "live" {
		return nil
	}
	dur, err := time.ParseDuration(toks[2])
	if err != nil {
		return nil
	}
	rtime := gregor1.ToTime(h.clock.Now().Add(dur))
	return &rtime
}

func (h *Location) isStop(toks []string) bool {
	if len(toks) != 2 {
		return false
	}
	return toks[1] == "stop"
}

func (h *Location) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string, replyTo *chat1.MessageID) (err error) {
	defer h.Trace(ctx, func() error { return err }, "Location")()
	if !h.Match(ctx, text) {
		return ErrInvalidCommand
	}
	toks := strings.Split(text, " ")
	if h.isStop(toks) {
		h.G().LiveLocationTracker.StopAllTracking(ctx)
		err := h.getChatUI().ChatCommandStatus(ctx, convID, "All location tracking stopped",
			chat1.UICommandStatusDisplayTyp_STATUS, nil)
		if err != nil {
			h.Debug(ctx, "Execute: error with command status: %+v", err)
		}
		return nil
	}
	var liveLocation chat1.LiveLocation
	liveLocationEndTime := h.isLiveLocation(toks)
	if liveLocationEndTime != nil {
		liveLocation.EndTime = *liveLocationEndTime
	}
	if _, err := h.G().ChatHelper.SendMsgByIDNonblock(ctx, convID, tlfName,
		chat1.NewMessageBodyWithText(chat1.MessageText{
			Body:         text,
			LiveLocation: &liveLocation,
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
			err := h.getChatUI().ChatCommandMarkdown(ctx, convID, nil)
			if err != nil {
				h.Debug(ctx, "Preview: error with markdown: %+v", err)
			}
			h.displayed = false
		}
		return
	}
	usage := fmt.Sprintf(locationUsage, "```", "```")
	err := h.getChatUI().ChatCommandMarkdown(ctx, convID, &chat1.UICommandMarkdown{
		Body:  utils.DecorateWithLinks(ctx, utils.EscapeForDecorate(ctx, usage)),
		Title: &locationTitle,
	})
	if err != nil {
		h.Debug(ctx, "Preview: error with markdown: %+v", err)
	}
	h.displayed = true
}

var locationTitle = `*/location*
Post your current location and a map rendered through the use of Google Maps.
`

var locationUsage = `We take care to guard your privacy: https://keybase.io/docs/chat/location.
Variations: %s
/location
/location live 1h
/location stop%s
`
