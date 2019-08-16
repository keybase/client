package client

import (
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type CmdTeamBotSettings struct {
	libkb.Contextified
	Team        string
	Username    string
	BotSettings *keybase1.TeamBotSettings
}

func newCmdTeamBotSettings(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := botSettingsFlags
	return cli.Command{
		Name:         "bot-settings",
		ArgumentHelp: "<team name>",
		Usage:        "Modify the bot settings of the given user. User must be a member of the given team with role `restrictedbot`",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdTeamBotSettingsRunner(g), "bot-settings", c)
		},
		Flags: append(flags,
			cli.StringFlag{
				Name:  "u, user",
				Usage: "username",
			}),
		Description: teamBotSettingsDoc,
	}
}

func NewCmdTeamBotSettingsRunner(g *libkb.GlobalContext) *CmdTeamBotSettings {
	return &CmdTeamBotSettings{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamBotSettings) ParseArgv(ctx *cli.Context) error {
	var err error
	c.Team, err = ParseOneTeamName(ctx)
	if err != nil {
		return err
	}

	c.Username, err = ParseUser(ctx)
	if err != nil {
		return err
	}

	c.BotSettings = ParseBotSettings(ctx)
	return nil
}

func (c *CmdTeamBotSettings) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	if err := ValidateBotSettingsConvs(c.G(), c.Team, c.BotSettings); err != nil {
		return err
	}

	var botSettings keybase1.TeamBotSettings
	if c.BotSettings == nil {
		arg := keybase1.TeamGetBotSettingsArg{
			Name:     c.Team,
			Username: c.Username,
		}
		botSettings, err = cli.TeamGetBotSettings(context.Background(), arg)
		if err != nil {
			return err
		}
	} else {
		botSettings = *c.BotSettings
		arg := keybase1.TeamSetBotSettingsArg{
			Name:        c.Team,
			Username:    c.Username,
			BotSettings: botSettings,
		}
		if err := cli.TeamSetBotSettings(context.Background(), arg); err != nil {
			return err
		}
	}

	var output string
	if botSettings.Cmds {
		// TODO call bot advertise list, build output
		output += "\t- command messages\n"
	}

	if botSettings.Mentions {
		output += "\t- when @-mentioned\n"
	}

	if len(botSettings.Triggers) > 0 {
		output += "\t- messages that match the following:\n\t\t"
		for _, trigger := range botSettings.Triggers {
			output += fmt.Sprintf("%q\n\t\t", trigger)
		}
		output += "\n"
	}

	dui := c.G().UI.GetDumbOutputUI()
	if len(output) == 0 {
		dui.Printf("%s will not receive any messages with the current bot settings\n", c.Username)
	} else {
		dui.Printf("%s will receive messages in the follow cases:\n%s", c.Username, output)
	}
	if len(botSettings.Convs) == 0 {
		dui.Printf("%s can receive/send into all conversations", c.Username)
	} else {
		dui.Printf("%s can send/receive into the following conversations:\n\t", c.Username)
		// TODO convert to human readable
		dui.Printf(strings.Join(botSettings.Convs, "\n\t"))
	}
	dui.Printf("\n")

	return nil
}

func (c *CmdTeamBotSettings) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

const teamBotSettingsDoc = `"keybase team bot-settings" allows you to view and modify the bot settings for restrictedbot team members.

EXAMPLES:

View current bot settings:

    keybase team bot-settings acme alice

Specify new bot settings:

    keybase team bot-settings acme alice --allow-mentions --triggers foo --triggers bar --allowed-convs #general
`
