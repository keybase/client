package client

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdChatAddEmojiAlias struct {
	libkb.Contextified
	resolvingRequest        chatConversationResolvingRequest
	newAlias, existingAlias string
}

func newCmdChatAddEmojiAlias(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "emoji-addalias",
		Usage:        "Add an alias to an existing emoji",
		ArgumentHelp: "<conversation> <existing alias> <new alias>",
		Action: func(c *cli.Context) {
			cmd := &CmdChatAddEmojiAlias{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "emoji-addalias", c)
		},
	}
}

func (c *CmdChatAddEmojiAlias) ParseArgv(ctx *cli.Context) error {
	var err error
	if len(ctx.Args()) != 3 {
		return fmt.Errorf("must specify an existing alias, new alias, and conversation name")
	}

	tlfName := ctx.Args()[0]
	c.existingAlias = ctx.Args()[1]
	c.newAlias = ctx.Args()[2]
	c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName)
	if err != nil {
		return err
	}
	return nil
}

func (c *CmdChatAddEmojiAlias) Run() error {
	ctx := context.Background()
	resolver, err := newChatConversationResolver(c.G())
	if err != nil {
		return err
	}
	if err = annotateResolvingRequest(c.G(), &c.resolvingRequest); err != nil {
		return err
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
	res, err := resolver.ChatClient.AddEmojiAlias(ctx, chat1.AddEmojiAliasArg{
		ConvID:        conversation.GetConvID(),
		NewAlias:      c.newAlias,
		ExistingAlias: c.existingAlias,
	})
	if err != nil {
		return err
	}
	if res.Error != nil {
		return errors.New(res.Error.Clidisplay)
	}
	return nil
}

func (c *CmdChatAddEmojiAlias) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
