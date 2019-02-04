package commands

import (
	"context"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Msg struct {
	*baseCommand
}

func NewMsg(g *globals.Context) *Msg {
	return &Msg{
		baseCommand: newBaseCommand(g, "msg", "<conversation> <message>",
			"Send a message to a conversation", "dm"),
	}
}

func (d *Msg) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) (err error) {
	defer d.Trace(ctx, func() error { return err }, "Execute")()
	if !d.Match(ctx, text) {
		return ErrInvalidCommand
	}
	toks, err := d.tokenize(text, 3)
	if err != nil {
		return err
	}
	conv, err := d.getConvByName(ctx, uid, toks[1])
	if err != nil {
		return err
	}
	text = strings.Join(toks[2:], " ")
	return d.G().ChatHelper.SendTextByIDNonblock(ctx, conv.GetConvID(), conv.Info.TlfName, text)
}
