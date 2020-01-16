package bots

import (
	"context"
	"fmt"
	"regexp"
	"sort"
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

func SortCommandsForMatching(cmds []chat1.UserBotCommandOutput) {
	// sort commands by reverse command length to prefer specificity (i.e. if
	// there's a longer command that matches the prefix, we'll match that
	// first.)
	sort.SliceStable(cmds, func(i, j int) bool {
		return len(cmds[i].Name) > len(cmds[j].Name)
	})
}

func ApplyTeamBotSettings(ctx context.Context, g *globals.Context, botUID gregor1.UID,
	botSettings keybase1.TeamBotSettings,
	msg chat1.MessagePlaintext, convID *chat1.ConversationID,
	mentionMap map[string]struct{}, debug utils.DebugLabeler) (bool, error) {

	// First make sure bot can receive on the given conversation. This ID may
	// be null if we are creating the conversation.
	if convID != nil && !botSettings.ConvIDAllowed(convID.String()) {
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
		re, err := regexp.Compile(fmt.Sprintf("(?i)%s", trigger))
		if err != nil {
			debug.Debug(ctx, "unable to compile trigger regex: %v", err)
			continue
		}
		if re.MatchString(matchText) {
			return true, nil
		}
	}

	// Check if any commands match (early out if it can't be a bot message)
	if !botSettings.Cmds || !strings.HasPrefix(matchText, "!") {
		return false, nil
	}
	unn, err := g.GetUPAKLoader().LookupUsername(ctx, keybase1.UID(botUID.String()))
	if err != nil {
		return false, err
	}
	if convID != nil {
		completeCh, err := g.BotCommandManager.UpdateCommands(ctx, *convID, nil)
		if err != nil {
			return false, err
		}
		if err := <-completeCh; err != nil {
			return false, err
		}
		cmds, _, err := g.BotCommandManager.ListCommands(ctx, *convID)
		if err != nil {
			return false, nil
		}
		SortCommandsForMatching(cmds)
		for _, cmd := range cmds {
			if unn.String() == cmd.Username && cmd.Matches(matchText) {
				return true, nil
			}
		}
	}
	return false, nil
}
