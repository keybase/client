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

type CmdChatAddEmoji struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	alias, filename  string
	allowOverwrite   bool
}

func newCmdChatAddEmoji(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "emoji-add",
		Usage:        "Add an emoji",
		ArgumentHelp: "<conversation> <alias> <filename or url>",
		Action: func(c *cli.Context) {
			cmd := &CmdChatAddEmoji{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "emoji-add", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "allow-overwrite",
				Usage: "Allow editing of an existing emoji.",
			},
		},
	}
}

func (c *CmdChatAddEmoji) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 3 {
		return fmt.Errorf("must specify an alias, filename, and conversation name")
	}

	tlfName := ctx.Args()[0]
	c.alias = ctx.Args()[1]
	c.filename = ctx.Args()[2]
	c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName)
	c.allowOverwrite = ctx.Bool("allow-overwrite")
	if err != nil {
		return err
	}
	return nil
}

func (c *CmdChatAddEmoji) Run() error {
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
	res, err := resolver.ChatClient.AddEmoji(ctx, chat1.AddEmojiArg{
		ConvID:         conversation.GetConvID(),
		Alias:          c.alias,
		Filename:       c.filename,
		AllowOverwrite: c.allowOverwrite,
	})
	if err != nil {
		return err
	}
	if res.Error != nil {
		return errors.New(res.Error.Clidisplay)
	}
	return nil
}

func (c *CmdChatAddEmoji) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
