package client

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

type CmdChatHide struct {
	libkb.Contextified
	resolvingRequest ChatConversationResolvingRequest
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
		},
		Flags: append(getConversationResolverFlags(), mustGetChatFlags("block", "unhide")...),
	}
}

func (c *CmdChatHide) ParseArgv(ctx *cli.Context) error {
	var err error

	if len(ctx.Args()) != 1 {
		cli.ShowCommandHelp(ctx, "send")
		return errors.New("Expecting exactly 1 arg")
	}
	tlfName := ctx.Args().Get(0)

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

	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}
	tlfClient, err := GetTlfClient(c.G())
	if err != nil {
		return err
	}
	resolver := &ChatConversationResolver{
		ChatClient: chatClient,
		TlfClient:  tlfClient,
	}

	conversationInfo, err := resolver.Resolve(ctx, c.resolvingRequest, c.G().UI.GetTerminalUI())
	if err != nil {
		return err
	}

	setStatusArg := chat1.SetConversationStatusLocalArg{
		ConversationID: conversationInfo.Id,
		Status:         c.status,
	}

	_, err = chatClient.SetConversationStatusLocal(ctx, setStatusArg)
	if err != nil {
		return err
	}
	return nil
}

func (c *CmdChatHide) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
