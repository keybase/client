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

type CmdChatRemoveEmoji struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	alias            string
}

func newCmdChatRemoveEmoji(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "emoji-remove",
		Usage:        "Remove an emoji",
		ArgumentHelp: "<conversation> <alias>",
		Action: func(c *cli.Context) {
			cmd := &CmdChatRemoveEmoji{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "emoji-remove", c)
		},
	}
}

func (c *CmdChatRemoveEmoji) ParseArgv(ctx *cli.Context) error {
	var err error
	if len(ctx.Args()) != 2 {
		return fmt.Errorf("must specify an alias and conversation name")
	}

	tlfName := ctx.Args()[0]
	c.alias = ctx.Args()[1]
	c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName)
	if err != nil {
		return err
	}
	return nil
}

func (c *CmdChatRemoveEmoji) Run() error {
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
	promptText := "Removing an emoji will cause all uses to be cleared. Hit Enter to confirm, Ctrl-C to cancel."
	if _, err = c.G().UI.GetTerminalUI().Prompt(PromptDescriptorChatEmojiRemove, promptText); err != nil {
		return err
	}
	_, err = resolver.ChatClient.RemoveEmoji(ctx, chat1.RemoveEmojiArg{
		ConvID: conversation.GetConvID(),
		Alias:  c.alias,
	})
	if err != nil {
		return err
	}
	return nil
}

func (c *CmdChatRemoveEmoji) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
