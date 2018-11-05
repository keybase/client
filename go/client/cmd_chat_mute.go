package client

import (
	"context"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdChatMute struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	status           chat1.ConversationStatus
}

func newCmdChatMute(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "mute",
		Usage:        "Mute or unmute a conversation.",
		ArgumentHelp: "[<conversation>]",
		Action: func(c *cli.Context) {
			cmd := &CmdChatMute{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "mute", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: append(getConversationResolverFlags(), mustGetChatFlags("unmute")...),
	}
}

func (c *CmdChatMute) ParseArgv(ctx *cli.Context) error {
	var err error

	if len(ctx.Args()) > 1 {
		return fmt.Errorf("too many arguments")
	}

	tlfName := ""
	if len(ctx.Args()) == 1 {
		tlfName = ctx.Args()[0]
	}

	c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName)
	if err != nil {
		return err
	}

	unmute := ctx.Bool("unmute")

	c.status = chat1.ConversationStatus_MUTED
	if unmute {
		c.status = chat1.ConversationStatus_UNFILED
	}

	return nil
}

func (c *CmdChatMute) Run() error {
	ctx := context.TODO()

	resolver, err := newChatConversationResolver(c.G())
	if err != nil {
		return err
	}

	if c.resolvingRequest.TlfName != "" {
		if err = annotateResolvingRequest(c.G(), &c.resolvingRequest); err != nil {
			return err
		}
	}

	conversation, _, err := resolver.Resolve(ctx, c.resolvingRequest, chatConversationResolvingBehavior{
		CreateIfNotExists: false,
		MustNotExist:      false,
		Interactive:       false,
		IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return err
	}

	setStatusArg := chat1.SetConversationStatusLocalArg{
		ConversationID: conversation.Info.Id,
		Status:         c.status,
	}

	_, err = resolver.ChatClient.SetConversationStatusLocal(ctx, setStatusArg)
	if err != nil {
		return err
	}
	return nil
}

func (c *CmdChatMute) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
