package client

import (
	"context"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

type CmdChatCreateChannel struct {
	g *libkb.GlobalContext

	resolvingRequest chatConversationResolvingRequest
	topicName        string
	nonBlock         bool
	team             bool
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
		ArgumentHelp: "[conversation [new channel name]]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatCreateChannelRunner(g), "create-channel", c)
		},
		Flags: append(getConversationResolverFlags(),
			mustGetChatFlags("nonblock")...),
	}
}

func (c *CmdChatCreateChannel) Run() error {
	return chatSend(context.TODO(), c.g, ChatSendArg{
		resolvingRequest: c.resolvingRequest,
		nonBlock:         c.nonBlock,
		team:             true,
		message:          fmt.Sprintf("joined #%s.", c.resolvingRequest.TopicName),
		setHeadline:      "",
		clearHeadline:    false,
		hasTTY:           true,
		setTopicName:     "",
		mustNotExist:     true,
	})
}

func (c *CmdChatCreateChannel) ParseArgv(ctx *cli.Context) (err error) {
	c.topicName = utils.SanitizeTopicName(ctx.String("channel"))
	c.nonBlock = ctx.Bool("nonblock")

	var tlfName string
	if len(ctx.Args()) >= 1 {
		tlfName = ctx.Args().Get(0)
	} else {
		return fmt.Errorf("Must supply team name.")
	}
	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
		return err
	}
	if c.resolvingRequest.Visibility == chat1.TLFVisibility_ANY {
		c.resolvingRequest.Visibility = chat1.TLFVisibility_PRIVATE
	}
	if c.topicName == "" {
		return fmt.Errorf("Must supply non-empty channel name.")
	}
	if len(ctx.Args()) > 1 {
		return fmt.Errorf("cannot send text message and set channel name simultaneously")
	}

	return nil
}

func (c *CmdChatCreateChannel) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
