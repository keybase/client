package client

import (
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
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
		Usage:        "Modify the bot settings of the given user. User must be a member of the given team with role restrictedbot.",
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

	if err := ValidateBotSettingsConvs(c.G(), c.Team,
		chat1.ConversationMembersType_TEAM, c.BotSettings); err != nil {
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
	if err := renderBotSettings(c.G(), c.Username, nil, botSettings); err != nil {
		return err
	}
	return nil
}

func renderBotSettings(g *libkb.GlobalContext, username string, convID *chat1.ConversationID, botSettings keybase1.TeamBotSettings) error {
	var output string
	if botSettings.Cmds {
		chatClient, err := GetChatLocalClient(g)
		if err != nil {
			return fmt.Errorf("Getting chat service client error: %s", err)
		}
		var cmds chat1.ListBotCommandsLocalRes
		if convID == nil {
			cmds, err = chatClient.ListPublicBotCommandsLocal(context.TODO(), username)
			if err != nil {
				return err
			}
		} else {
			cmds, err = chatClient.ListBotCommandsLocal(context.TODO(), *convID)
			if err != nil {
				return err
			}
		}

		if len(cmds.Commands) > 0 {
			output += "\t- command messages for the following commands: \n"
		} else {
			output += "\t- command messages\n"
		}
		username = libkb.NewNormalizedUsername(username).String()
		for _, cmd := range cmds.Commands {
			if cmd.Username == username {
				output += fmt.Sprintf("\t\t- !%s\n", cmd.Name)
			}
		}
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

	dui := g.UI.GetDumbOutputUI()
	if len(output) == 0 {
		dui.Printf("%s will not receive any messages with the current bot settings\n", username)
	} else {
		dui.Printf("%s will receive messages in the following cases:\n%s", username, output)
	}
	if len(botSettings.Convs) == 0 {
		dui.Printf("%s can send/receive into all conversations", username)
	} else {
		dui.Printf("%s can send/receive into the following conversations:\n\t", username)
		convIDs := []chat1.ConvIDStr{}
		for _, conv := range botSettings.Convs {
			convIDs = append(convIDs, chat1.ConvIDStr(conv))
		}
		convNames, err := getConvNames(g, convIDs)
		if err != nil {
			return err
		}
		dui.Printf(strings.Join(convNames, "\n\t"))
	}
	dui.Printf("\n")
	return nil
}

func getConvNames(g *libkb.GlobalContext, convs []chat1.ConvIDStr) (convNames []string, err error) {
	fetcher := chatCLIInboxFetcher{}
	for _, convIDStr := range convs {
		convID, err := chat1.MakeConvID(convIDStr.String())
		if err != nil {
			return nil, err
		}
		if convID.IsNil() {
			continue
		}
		fetcher.query.ConvIDs = append(fetcher.query.ConvIDs, convID)
	}
	conversations, err := fetcher.fetch(context.TODO(), g)
	if err != nil {
		return nil, err
	}
	v := conversationListView(conversations)
	for _, conv := range v {
		convNames = append(convNames, v.convName(g, conv, g.Env.GetUsername().String()))
	}

	return convNames, nil
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

    keybase team bot-settings acme -u alice

Specify new bot settings:

    keybase team bot-settings acme -u alice --allow-mentions --triggers foo --triggers bar --allowed-convs #general
`
