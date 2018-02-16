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

type CmdChatReport struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	status           chat1.ConversationStatus
}

func newCmdChatReport(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "report",
		Usage:        "Report a conversation (also blocks it)",
		ArgumentHelp: "[<conversation>]",
		Action: func(c *cli.Context) {
			cmd := &CmdChatReport{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "report", c)
		},
		Flags: getConversationResolverFlags(),
	}
}

func (c *CmdChatReport) ParseArgv(ctx *cli.Context) error {
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

	c.status = chat1.ConversationStatus_REPORTED
	return nil
}

func (c *CmdChatReport) Run() error {
	ctx := context.Background()

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

func (c *CmdChatReport) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
