package bots

import "github.com/keybase/client/go/protocol/chat1"

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
