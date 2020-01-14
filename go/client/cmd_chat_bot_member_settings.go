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

type CmdChatBotMemberSettings struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	username         string
	botSettings      *keybase1.TeamBotSettings
	hasTTY           bool
}

func NewCmdChatBotMemberSettingsRunner(g *libkb.GlobalContext) *CmdChatBotMemberSettings {
	return &CmdChatBotMemberSettings{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatBotMemberSettings(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := append(getConversationResolverFlags(), botSettingsFlags...)
	flags = append(flags, cli.StringFlag{
		Name:  "u, user",
		Usage: "username",
	})
	return cli.Command{
		Name:         "bot-member-settings",
		Usage:        "View or modify a restricted bot's isolation settings.",
		ArgumentHelp: "[conversation]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatBotMemberSettingsRunner(g), "bot-member-settings", c)
			cl.SetNoStandalone()
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: flags,
	}
}

func (c *CmdChatBotMemberSettings) Run() (err error) {
	resolver, conversationInfo, err := resolveConversationForBotMember(c.G(), c.resolvingRequest, c.hasTTY)
	if err != nil {
		return err
	}

	if err := ValidateBotSettingsConvs(c.G(), conversationInfo.TlfName,
		conversationInfo.MembersType, c.botSettings); err != nil {
		return err
	}

	var botSettings keybase1.TeamBotSettings
	if c.botSettings == nil {
		botSettings, err = resolver.ChatClient.GetBotMemberSettings(context.TODO(), chat1.GetBotMemberSettingsArg{
			ConvID:   conversationInfo.Id,
			Username: c.username,
		})
		if err != nil {
			return err
		}
	} else {
		botSettings = *c.botSettings
		if err = resolver.ChatClient.SetBotMemberSettings(context.TODO(), chat1.SetBotMemberSettingsArg{
			ConvID:      conversationInfo.Id,
			Username:    c.username,
			BotSettings: botSettings,
		}); err != nil {
			return err
		}
	}
	if err := renderBotSettings(c.G(), c.username, &conversationInfo.Id, botSettings); err != nil {
		return err
	}

	return nil
}

func (c *CmdChatBotMemberSettings) ParseArgv(ctx *cli.Context) (err error) {
	c.username, err = ParseUser(ctx)
	if err != nil {
		return err
	}

	c.botSettings = ParseBotSettings(ctx)
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

func (c *CmdChatBotMemberSettings) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
