package client

import (
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/chat/utils"
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
		return 0, errors.New("invalid team role, please use owner, admin, writer, reader, bot, or restrictedbot")
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
		Name:  "allow-commands",
		Usage: "Restricted bots will receive messages that begin with commands they support.",
	},
	cli.BoolFlag{
		Name:  "allow-mentions",
		Usage: "Restricted bots will receive messages when they are @-mentioned.",
	},
	cli.StringSliceFlag{
		Name: "allow-trigger",
		Usage: `Restricted bots will receive messages that match the given text.
	Can be a regular expression. Can be specified multiple times.`,
	},
	cli.StringSliceFlag{
		Name: "allow-conversation",
		Usage: `Restricted bots will only be able to send/receive messages in the given conversations.
	If not specified all conversations are allowed. Can be specified multiple times.`,
	},
}

func ParseBotSettings(ctx *cli.Context) *keybase1.TeamBotSettings {
	if !(ctx.IsSet("allow-commands") ||
		ctx.IsSet("allow-mentions") ||
		ctx.IsSet("allow-trigger") ||
		ctx.IsSet("allow-conversation")) {
		return nil
	}
	return &keybase1.TeamBotSettings{
		Cmds:     ctx.Bool("allow-commands"),
		Mentions: ctx.Bool("allow-mentions"),
		Triggers: ctx.StringSlice("allow-trigger"),
		Convs:    ctx.StringSlice("allow-conversation"),
	}
}

func ValidateBotSettingsConvs(g *libkb.GlobalContext, tlfName string,
	mt chat1.ConversationMembersType, botSettings *keybase1.TeamBotSettings) error {
	if botSettings == nil {
		return nil
	}
	convIDs, err := lookupConvIDsByTopicName(g, tlfName, mt, botSettings.Convs)
	if err != nil {
		return err
	}
	var convs []string
	for _, convID := range convIDs {
		convs = append(convs, convID.String())
	}

	botSettings.Convs = convs
	return nil
}

func lookupConvIDsByTopicName(g *libkb.GlobalContext, tlfName string,
	mt chat1.ConversationMembersType, convs []string) (convIDs []chat1.ConvIDStr, err error) {
	resolver, err := newChatConversationResolver(g)
	if err != nil {
		return nil, err
	}
	for _, topicName := range convs {
		topicName = utils.SanitizeTopicName(topicName)
		conv, _, err := resolver.Resolve(context.TODO(), chatConversationResolvingRequest{
			TlfName:     tlfName,
			TopicName:   topicName,
			TopicType:   chat1.TopicType_CHAT,
			MembersType: mt,
		}, chatConversationResolvingBehavior{
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		if err != nil {
			return nil, err
		}
		if conv == nil {
			return nil, fmt.Errorf("conversation %s not found", topicName)
		}
		convIDs = append(convIDs, conv.GetConvID().ConvIDStr())
	}
	return convIDs, nil
}
