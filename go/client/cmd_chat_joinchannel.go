package client

import (
	"context"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdChatJoinChannel struct {
	libkb.Contextified

	topicName, teamName string
	topicType           chat1.TopicType
}

func NewCmdChatJoinChannelRunner(g *libkb.GlobalContext) *CmdChatJoinChannel {
	return &CmdChatJoinChannel{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatJoinChannel(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "join-channel",
		Usage:        "Join a conversation channel",
		ArgumentHelp: "<team name> <channel name>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatJoinChannelRunner(g), "join-channel", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: mustGetChatFlags("topic-type"),
	}
}

func (c *CmdChatJoinChannel) Run() error {
	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.Background()
	_, err = chatClient.JoinConversationLocal(ctx, chat1.JoinConversationLocalArg{
		TlfName:    c.teamName,
		TopicType:  c.topicType,
		Visibility: keybase1.TLFVisibility_PRIVATE,
		TopicName:  c.topicName,
	})
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdChatJoinChannel) ParseArgv(ctx *cli.Context) (err error) {
	if c.topicType, err = parseConversationTopicType(ctx); err != nil {
		return err
	}

	if len(ctx.Args()) != 2 {
		return fmt.Errorf("wrong number of arguments")
	}

	c.teamName = ctx.Args().Get(0)
	c.topicName = utils.SanitizeTopicName(ctx.Args().Get(1))
	return nil
}

func (c *CmdChatJoinChannel) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
