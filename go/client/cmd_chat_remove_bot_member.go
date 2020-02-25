package client

import (
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	isatty "github.com/mattn/go-isatty"
	context "golang.org/x/net/context"
)

type CmdChatRemoveBotMember struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	username         string
	hasTTY           bool
}

func NewCmdChatRemoveBotMemberRunner(g *libkb.GlobalContext) *CmdChatRemoveBotMember {
	return &CmdChatRemoveBotMember{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatRemoveBotMember(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := getConversationResolverFlags()
	flags = append(flags, cli.StringFlag{
		Name:  "u, user",
		Usage: "username",
	})
	return cli.Command{
		Name:         "remove-bot-member",
		Usage:        "Remove a bot or a restricted bot from a conversation",
		ArgumentHelp: "[conversation]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatRemoveBotMemberRunner(g), "remove-bot-member", c)
			cl.SetNoStandalone()
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: flags,
	}
}

func (c *CmdChatRemoveBotMember) Run() (err error) {
	resolver, conversationInfo, err := resolveConversationForBotMember(c.G(), c.resolvingRequest, c.hasTTY)
	if err != nil {
		return err
	}

	if err = resolver.ChatClient.RemoveBotMember(context.TODO(), chat1.RemoveBotMemberArg{
		ConvID:   conversationInfo.Id,
		Username: c.username,
	}); err != nil {
		return err
	}
	return nil
}

func (c *CmdChatRemoveBotMember) ParseArgv(ctx *cli.Context) (err error) {
	c.username, err = ParseUser(ctx)
	if err != nil {
		return err
	}

	c.hasTTY = isatty.IsTerminal(os.Stdin.Fd())

	var tlfName string
	// Get the TLF name from the first position arg
	if len(ctx.Args()) >= 1 {
		tlfName = ctx.Args().Get(0)
	}
	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
		return err
	}
	return nil
}

func (c *CmdChatRemoveBotMember) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
