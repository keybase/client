package client

import (
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

func ParseOneTeamName(ctx *cli.Context) (string, error) {
	if len(ctx.Args()) == 0 {
		return "", errors.New("team name argument required")
	}
	if len(ctx.Args()) > 1 {
		return "", errors.New("one team name argument required, multiple found")
	}
	return ctx.Args()[0], nil
}

func ParseOneTeamNameK1(ctx *cli.Context) (res keybase1.TeamName, err error) {
	teamNameStr, err := ParseOneTeamName(ctx)
	if err != nil {
		return res, err
	}
	return keybase1.TeamNameFromString(teamNameStr)
}

func ParseOneTeamID(ctx *cli.Context) (res keybase1.TeamID, err error) {
	if len(ctx.Args()) == 0 {
		return "", errors.New("team ID argument required")
	}
	if len(ctx.Args()) > 1 {
		return "", errors.New("one team ID argument required, multiple found")
	}
	return keybase1.TeamIDFromString(ctx.Args()[0])
}

func ParseUser(ctx *cli.Context) (string, error) {
	username := ctx.String("user")
	if len(username) == 0 {
		return "", errors.New("username required via --user flag")
	}
	return username, nil
}

func ParseRole(ctx *cli.Context) (keybase1.TeamRole, error) {
	srole := ctx.String("role")
	if srole == "" {
		return 0, errors.New("team role required via --role flag")
	}

	role, ok := keybase1.TeamRoleMap[strings.ToUpper(srole)]
	if !ok {
		// TODO(HOTPOT-599) update to include bot roles
		return 0, errors.New("invalid team role, please use owner, admin, writer, or reader")
	}

	return role, nil
}

func ParseUserAndRole(ctx *cli.Context) (string, keybase1.TeamRole, error) {
	username, err := ParseUser(ctx)
	if err != nil {
		return "", 0, err
	}
	role, err := ParseRole(ctx)
	if err != nil {
		return "", 0, err
	}
	return username, role, nil
}

var botSettingsFlags = []cli.Flag{
	cli.BoolFlag{
		Name:  "bot-settings-allow-commands",
		Usage: "Bots will receive messages that begin with commands they support. TODO keybase chat bot-advertise-list. Only applies if --role=restrictedbot.",
	},
	cli.BoolFlag{
		Name:  "bot-settings-allow-mentions",
		Usage: "Bots will receive messages when they are @-mentioned. Only applies if --role=restrictedbot.",
	},
	cli.StringSliceFlag{
		Name:  "bot-settings-triggers",
		Usage: "Bots will receive messages that match the given text. Can be a regular expression. Can be specified multiple times. Only applies if --role=restrictedbot.",
	},
	cli.StringSliceFlag{
		Name:  "bot-settings-allowed-conversations",
		Usage: "Bots will only be able to send/receive messages in the given conversations. If not specified all conversations are allowed. Can be specified multiple times. Only applies if --role=restrictedbot.",
	},
}

func ParseBotSettings(ctx *cli.Context) *keybase1.TeamBotSettings {
	return &keybase1.TeamBotSettings{
		Cmds:     ctx.Bool("bot-settings-allow-commands"),
		Mentions: ctx.Bool("bot-settings-allow-mentions"),
		Triggers: ctx.StringSlice("bot-settings-triggers"),
		Convs:    ctx.StringSlice("bot-settings-allowed-conversations"),
	}
}

func ValidateBotSettingsConvs(g *libkb.GlobalContext, teamName string,
	botSettings *keybase1.TeamBotSettings) error {
	if botSettings == nil {
		return nil
	}

	var convIDs []string
	resolver, err := newChatConversationResolver(g)
	if err != nil {
		return err
	}
	for _, topicName := range botSettings.Convs {
		conv, _, err := resolver.Resolve(context.TODO(), chatConversationResolvingRequest{
			TlfName:     teamName,
			TopicName:   topicName,
			TopicType:   chat1.TopicType_CHAT,
			MembersType: chat1.ConversationMembersType_TEAM,
		}, chatConversationResolvingBehavior{
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		if err != nil {
			return err
		}
		if conv == nil {
			return fmt.Errorf("conversation %s not found", topicName)
		}
		convIDs = append(convIDs, conv.GetConvID().String())
	}
	botSettings.Convs = convIDs
	return nil
}
