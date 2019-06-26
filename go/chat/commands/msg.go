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
			"Send a message to a conversation", false, "dm"),
	}
}

func (d *Msg) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string, replyTo *chat1.MessageID) (err error) {
	defer d.Trace(ctx, func() error { return err }, "Execute")()
	if !d.Match(ctx, text) {
		return ErrInvalidCommand
	}
	defer func() {
		if err != nil {
			d.getChatUI().ChatCommandStatus(ctx, convID, "Failed to send message",
				chat1.UICommandStatusDisplayTyp_ERROR, nil)
		}
	}()
	toks, err := d.tokenize(text, 3)
	if err != nil {
		return err
	}
	conv, err := getConvByName(ctx, d.G(), uid, toks[1])
	if err != nil {
		return err
	}
	text = strings.Join(toks[2:], " ")
	_, err = d.G().ChatHelper.SendTextByIDNonblock(ctx, conv.GetConvID(), conv.Info.TlfName, text, nil,
		replyTo)
	return err
}
