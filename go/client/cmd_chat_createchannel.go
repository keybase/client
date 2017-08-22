package client

import (
	"context"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

type CmdChatCreateChannel struct {
	g *libkb.GlobalContext

	resolvingRequest chatConversationResolvingRequest
}

func NewCmdChatCreateChannelRunner(g *libkb.GlobalContext) *CmdChatCreateChannel {
	return &CmdChatCreateChannel{
		g: g,
	}
}

func newCmdChatCreateChannel(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "create-channel",
		Usage:        "Create a conversation channel",
		ArgumentHelp: "<team name> <channel name>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatCreateChannelRunner(g), "create-channel", c)
		},
		Flags: mustGetChatFlags("topic-type"),
	}
}

func (c *CmdChatCreateChannel) Run() error {
	c.g.StartStandaloneChat()
	return chatSend(context.TODO(), c.g, ChatSendArg{
		resolvingRequest: c.resolvingRequest,
		nonBlock:         false,
		team:             true,
		message:          fmt.Sprintf("Welcome to #%s!", c.resolvingRequest.TopicName),
		setHeadline:      "",
		clearHeadline:    false,
		hasTTY:           true,
		setTopicName:     "",
		mustNotExist:     true,
	})
}

func (c *CmdChatCreateChannel) ParseArgv(ctx *cli.Context) (err error) {

	var tlfName, topicName string
	var topicType chat1.TopicType

	if len(ctx.Args()) == 2 {
		tlfName = ctx.Args().Get(0)
		topicName = ctx.Args().Get(1)
	} else {
		return fmt.Errorf("create channel takes two arguments.")
	}
	if topicType, err = parseConversationTopicType(ctx); err != nil {
		return err
	}

	c.resolvingRequest.TlfName = tlfName
	c.resolvingRequest.TopicType = topicType
	c.resolvingRequest.TopicName = topicName
	c.resolvingRequest.MembersType = chat1.ConversationMembersType_TEAM
	c.resolvingRequest.Visibility = chat1.TLFVisibility_PRIVATE

	return nil
}

func (c *CmdChatCreateChannel) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
