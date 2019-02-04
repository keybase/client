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

type CmdChatKBFSUpgrade struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
}

func newCmdChatKBFSUpgrade(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "kbfs-upgrade",
		Usage:        "upgrade a conversation from KBFS to implicit team backed",
		ArgumentHelp: "[<conversation>]",
		Action: func(c *cli.Context) {
			cmd := &CmdChatKBFSUpgrade{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "kbfs-upgrade", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: getConversationResolverFlags(),
	}
}

func (c *CmdChatKBFSUpgrade) ParseArgv(ctx *cli.Context) error {
	var err error

	if len(ctx.Args()) != 1 {
		return fmt.Errorf("wrong number of arguments")
	}
	tlfName := ctx.Args()[0]

	c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdChatKBFSUpgrade) Run() error {
	ctx := context.TODO()

	resolver, err := newChatConversationResolver(c.G())
	if err != nil {
		return err
	}

	c.resolvingRequest.MembersType = chat1.ConversationMembersType_KBFS
	conversation, _, err := resolver.Resolve(ctx, c.resolvingRequest, chatConversationResolvingBehavior{
		CreateIfNotExists: false,
		MustNotExist:      false,
		Interactive:       false,
		IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return err
	}
	return resolver.ChatClient.UpgradeKBFSConversationToImpteam(ctx, conversation.GetConvID())
}

func (c *CmdChatKBFSUpgrade) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
