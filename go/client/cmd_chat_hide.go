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

type CmdChatHide struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	status           chat1.ConversationStatus
}

func newCmdChatHide(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "hide",
		Usage:        "Hide or block a conversation.",
		ArgumentHelp: "[<conversation>]",
		Action: func(c *cli.Context) {
			cmd := &CmdChatHide{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "hide", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: append(getConversationResolverFlags(), mustGetChatFlags("block", "unhide")...),
	}
}

func (c *CmdChatHide) ParseArgv(ctx *cli.Context) error {
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

	block := ctx.Bool("block")
	unhide := ctx.Bool("unhide")

	c.status = chat1.ConversationStatus_IGNORED
	if block && unhide {
		return fmt.Errorf("cannot do both --block and --unhide")
	}
	if block {
		c.status = chat1.ConversationStatus_BLOCKED
	}
	if unhide {
		c.status = chat1.ConversationStatus_UNFILED
	}

	return nil
}

func (c *CmdChatHide) Run() error {
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
		CreateIfNotExists:       false,
		MustNotExist:            false,
		Interactive:             false,
		IgnoreConversationError: true, // If we are reset, we still want to be able to hide the conv.
		IdentifyBehavior:        keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return err
	}

	setStatusArg := chat1.SetConversationStatusLocalArg{
		ConversationID: conversation.Info.Id,
		Status:         c.status,
	}

	_, err = resolver.ChatClient.SetConversationStatusLocal(ctx, setStatusArg)
	return err
}

func (c *CmdChatHide) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
