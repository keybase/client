package commands

import (
	"context"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type DM struct {
	*baseCommand
}

func NewDM(g *globals.Context) *DM {
	return &DM{
		baseCommand: newBaseCommand(g, "msg", "@user message", "dm"),
	}
}

func (d *DM) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) (err error) {
	defer d.Trace(ctx, func() error { return err }, "Execute")()
	if !d.Match(ctx, text) {
		return ErrInvalidCommand
	}
	toks := strings.Split(text, " ")
	if len(toks) < 3 {
		return ErrInvalidArguments
	}
	tlfName = toks[1]
	text = strings.Join(toks[2:], " ")
	return d.G().ChatHelper.SendTextByNameNonblock(ctx, tlfName, nil,
		chat1.ConversationMembersType_IMPTEAMNATIVE, keybase1.TLFIdentifyBehavior_GUI, text)
}
