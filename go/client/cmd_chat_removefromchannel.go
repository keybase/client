// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdChatRemoveFromChannel struct {
	libkb.Contextified
	teamName    string
	channelName string
	users       []string
	topicType   chat1.TopicType
}

func NewCmdChatRemoveFromChannelRunner(g *libkb.GlobalContext) *CmdChatRemoveFromChannel {
	return &CmdChatRemoveFromChannel{Contextified: libkb.NewContextified(g)}
}

func newCmdChatRemoveFromChannel(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "remove-from-channel",
		Usage:        "Remove one or more users from a channel",
		ArgumentHelp: "<team> <channel> <usernames>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatRemoveFromChannelRunner(g), "remove-from-channel", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags:       mustGetChatFlags("topic-type"),
		Description: chatRemoveFromChannelDoc,
	}
}

func (c *CmdChatRemoveFromChannel) Run() error {
	ctx := context.TODO()
	resolver, err := newChatConversationResolver(c.G())
	if err != nil {
		return err
	}
	req := chatConversationResolvingRequest{
		TlfName:     c.teamName,
		TopicName:   c.channelName,
		TopicType:   c.topicType,
		MembersType: chat1.ConversationMembersType_TEAM,
		Visibility:  keybase1.TLFVisibility_PRIVATE,
	}
	conversation, _, err := resolver.Resolve(ctx, req, chatConversationResolvingBehavior{
		CreateIfNotExists: false,
		MustNotExist:      false,
		Interactive:       false,
		IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return err
	}
	_, err = resolver.ChatClient.RemoveFromConversationLocal(ctx, chat1.RemoveFromConversationLocalArg{
		ConvID:    conversation.GetConvID(),
		Usernames: c.users,
	})
	if err == nil {
		dui := c.G().UI.GetDumbOutputUI()
		dui.Printf("Success!\n")
		return nil
	}
	return err
}

func (c *CmdChatRemoveFromChannel) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 3 {
		return errors.New("remove-from-channel takes three arguments")
	}

	c.teamName = ctx.Args().Get(0)
	c.channelName = utils.SanitizeTopicName(ctx.Args().Get(1))

	userString := ctx.Args().Get(2)
	if len(userString) == 0 {
		return errors.New("remove-from-channel needs at least one user")
	}
	users := strings.Split(userString, ",")
	for _, user := range users {
		if len(user) == 0 {
			return errors.New("cannot specify an empty user")
		}
		c.users = append(c.users, user)
	}

	c.topicType, err = parseConversationTopicType(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdChatRemoveFromChannel) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

const chatRemoveFromChannelDoc = `"keybase chat remove-from-channel" allows you to remove one or more users from a channel

EXAMPLES:

Remove a single keybase user:

    keybase chat remove-from-channel acme announcements alice

Remove multiple keybase users:

    keybase chat remove-from-channel acme announcements alice,bob,charlie
`
