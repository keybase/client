package bots

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func MakeConversationCommandGroups(cmds []chat1.UserBotCommandOutput) chat1.ConversationCommandGroups {
	var outCmds []chat1.ConversationCommand
	for _, cmd := range cmds {
		username := cmd.Username
		outCmds = append(outCmds, chat1.ConversationCommand{
			Name:        cmd.Name,
			Description: cmd.Description,
			Usage:       cmd.Usage,
			HasHelpText: cmd.ExtendedDescription != nil,
			Username:    &username,
		})
	}
	return chat1.NewConversationCommandGroupsWithCustom(chat1.ConversationCommandGroupsCustom{
		Commands: outCmds,
	})
}

func ApplyTeamBotSettings(ctx context.Context, g *globals.Context, botUID gregor1.UID,
	botSettings keybase1.TeamBotSettings,
	msg chat1.MessagePlaintext, conv *chat1.ConversationLocal,
	mentionMap map[string]struct{}, debug utils.DebugLabeler) (bool, error) {
	// First make sure bot can receive on the given conversation
	convAllowed := len(botSettings.Convs) == 0
	for _, convIDStr := range botSettings.Convs {
		convID, err := chat1.MakeConvID(convIDStr)
		if err != nil {
			debug.Debug(ctx, "unable to parse convID: %v", err)
			continue
		}
		if convID.Eq(conv.GetConvID()) {
			convAllowed = true
			break
		}
	}
	if !convAllowed {
		return false, nil
	}

	// If the sender is the bot, always match
	if msg.ClientHeader.Sender.Eq(botUID) {
		return true, nil
	}

	switch msg.ClientHeader.MessageType {
	// DELETEHISTORY messages are always keyed for bots in case they need to
	// clear messages
	case chat1.MessageType_DELETEHISTORY:
		return true, nil
	// Bots never get these
	case chat1.MessageType_NONE,
		chat1.MessageType_METADATA,
		chat1.MessageType_TLFNAME,
		chat1.MessageType_HEADLINE,
		chat1.MessageType_JOIN,
		chat1.MessageType_LEAVE,
		chat1.MessageType_SYSTEM:
		return false, nil
	}

	// check mentions
	if _, ok := mentionMap[botUID.String()]; ok && botSettings.Mentions {
		return true, nil
	}

	// See if any triggers match
	matchText := msg.SearchableText()
	for _, trigger := range botSettings.Triggers {
		re, err := regexp.Compile(trigger)
		if err != nil {
			debug.Debug(ctx, "unable to compile trigger regex: %v", err)
			continue
		}
		if re.MatchString(matchText) {
			return true, nil
		}
	}

	// Check if any commands match
	if !botSettings.Cmds {
		return false, nil
	}
	unn, err := g.GetUPAKLoader().LookupUsername(ctx, keybase1.UID(botUID.String()))
	if err != nil {
		return false, err
	}
	cmds, err := g.BotCommandManager.ListCommands(ctx, conv.GetConvID())
	if err != nil {
		return false, nil
	}
	for _, cmd := range cmds {
		if unn.String() == cmd.Username && strings.HasPrefix(matchText, fmt.Sprintf("!%s", cmd.Name)) {
			return true, nil
		}
	}
	return false, nil
}
