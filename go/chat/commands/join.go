package commands

import (
	"context"
	"errors"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Join struct {
	*baseCommand
}

func NewJoin(g *globals.Context) *Join {
	return &Join{
		baseCommand: newBaseCommand(g, "join", "<channel> [team]"),
	}
}

func (h *Join) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) (err error) {
	defer h.Trace(ctx, func() error { return err }, "Join")()
	if !h.Match(ctx, text) {
		return ErrInvalidCommand
	}
	var teamName string
	toks := strings.Split(text, " ")
	if len(toks) >= 3 {
		teamName = toks[2]
	} else {
		convs, err := h.G().ChatHelper.FindConversationsByID(ctx, []chat1.ConversationID{convID})
		if err != nil {
			return err
		}
		if len(convs) == 0 {
			return errors.New("no conversation found")
		}
		conv := convs[0]
		if conv.GetMembersType() != chat1.ConversationMembersType_TEAM {
			return errors.New("not a team conversation")
		}
		teamName = conv.Info.TlfName
	}
}
