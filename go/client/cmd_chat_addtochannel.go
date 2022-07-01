// Copyright 2019 Keybase, Inc. All rights reserved. Use of
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

type CmdChatAddToChannel struct {
	libkb.Contextified
	teamName    string
	channelName string
	users       []string
	topicType   chat1.TopicType
}

func NewCmdChatAddToChannelRunner(g *libkb.GlobalContext) *CmdChatAddToChannel {
	return &CmdChatAddToChannel{Contextified: libkb.NewContextified(g)}
}

func newCmdChatAddToChannel(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "add-to-channel",
		Usage:        "Add one or more users to a channel",
		ArgumentHelp: "<team> <channel> <usernames>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatAddToChannelRunner(g), "add-to-channel", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags:       mustGetChatFlags("topic-type"),
		Description: chatAddToChannelDoc,
	}
}

func (c *CmdChatAddToChannel) Run() error {
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
	err = resolver.ChatClient.BulkAddToConv(ctx, chat1.BulkAddToConvArg{
		Usernames: c.users,
		ConvID:    conversation.GetConvID(),
	})
	if err == nil {
		dui := c.G().UI.GetDumbOutputUI()
		dui.Printf("Success!\n")
		return nil
	}
	return err
}

func (c *CmdChatAddToChannel) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 3 {
		return errors.New("add-to-channel takes three arguments")
	}

	c.teamName = ctx.Args().Get(0)
	c.channelName = utils.SanitizeTopicName(ctx.Args().Get(1))

	userString := ctx.Args().Get(2)
	if len(userString) == 0 {
		return errors.New("add-to-channel needs at least one user")
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

func (c *CmdChatAddToChannel) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

const chatAddToChannelDoc = `"keybase chat add-to-channel" allows you to add one or more users to a channel

EXAMPLES:

Add a single keybase user:

    keybase chat add-to-channel acme announcements alice

Add multiple keybase users:

    keybase chat add-to-channel acme announcements alice,bob,charlie
`
