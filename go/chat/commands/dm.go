package commands

import (
	"context"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type DM struct {
	*baseCommand
}

func NewDM(g *globals.Context) *DM {
	return &DM{
		baseCommand: newBaseCommand(g, "msg", "<conversation> <message>",
			"Send a message in the specified conversation", "dm"),
	}
}

func (d *DM) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) (err error) {
	defer d.Trace(ctx, func() error { return err }, "Execute")()
	if !d.Match(ctx, text) {
		return ErrInvalidCommand
	}
	toks := d.tokenize(text)
	if len(toks) < 3 {
		return ErrInvalidArguments
	}
	conv, err := d.getConvByName(ctx, uid, toks[1])
	if err != nil {
		return err
	}
	text = strings.Join(toks[2:], " ")
	return d.G().ChatHelper.SendTextByIDNonblock(ctx, conv.GetConvID(), conv.Info.TlfName, text)
}
