package client

import (
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	isatty "github.com/mattn/go-isatty"
	context "golang.org/x/net/context"
)

type CmdChatEditBotMember struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	username         string
	role             keybase1.TeamRole
	botSettings      *keybase1.TeamBotSettings
	hasTTY           bool
}

func NewCmdChatEditBotMemberRunner(g *libkb.GlobalContext) *CmdChatEditBotMember {
	return &CmdChatEditBotMember{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatEditBotMember(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := append(getConversationResolverFlags(), botSettingsFlags...)
	flags = append(flags, cli.StringFlag{
		Name:  "u, user",
		Usage: "username",
	}, cli.StringFlag{
		Name:  "r, role",
		Usage: "team role (bot, restrictedbot)",
	})
	return cli.Command{
		Name:         "edit-bot-member",
		Usage:        "Edit the role bot or a restricted bot in a conversation.",
		ArgumentHelp: "[conversation]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatEditBotMemberRunner(g), "edit-bot-member", c)
			cl.SetNoStandalone()
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: flags,
	}
}

func (c *CmdChatEditBotMember) Run() (err error) {
	resolver, conversationInfo, err := resolveConversationForBotMember(c.G(), c.resolvingRequest, c.hasTTY)
	if err != nil {
		return err
	}

	if err := ValidateBotSettingsConvs(c.G(), conversationInfo.TlfName, conversationInfo.MembersType, c.botSettings); err != nil {
		return err
	}

	if err = resolver.ChatClient.EditBotMember(context.TODO(), chat1.EditBotMemberArg{
		ConvID:      conversationInfo.Id,
		Username:    c.username,
		Role:        c.role,
		BotSettings: c.botSettings,
	}); err != nil {
		return err
	}
	return nil
}

func (c *CmdChatEditBotMember) ParseArgv(ctx *cli.Context) (err error) {
	c.role, err = ParseRole(ctx)
	if err != nil {
		return err
	}
	c.username, err = ParseUser(ctx)
	if err != nil {
		return err
	}

	if c.role.IsRestrictedBot() {
		c.botSettings = ParseBotSettings(ctx)
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

func (c *CmdChatEditBotMember) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
