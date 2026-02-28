package client

import (
	"context"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type CmdChatRenameChannel struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	setTopicName     string
}

func NewCmdChatRenameChannelRunner(g *libkb.GlobalContext) *CmdChatRenameChannel {
	return &CmdChatRenameChannel{Contextified: libkb.NewContextified(g)}
}

func newCmdChatRenameChannel(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "rename-channel",
		Usage:        "Rename a channel",
		ArgumentHelp: "<team name> <old channel name> <new channel name>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatRenameChannelRunner(g), "rename-channel", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: mustGetChatFlags("topic-type"),
	}
}

func (c *CmdChatRenameChannel) Run() error {
	c.G().StartStandaloneChat()
	return chatSend(context.TODO(), c.G(), ChatSendArg{
		resolvingRequest: c.resolvingRequest,
		setTopicName:     c.setTopicName,
		team:             true,
		message:          "",
		setHeadline:      "",
		clearHeadline:    false,
		hasTTY:           true,
	})
}

func (c *CmdChatRenameChannel) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 3 {
		return fmt.Errorf("wrong number of arguments")
	}

	teamName := ctx.Args().Get(0)
	oldChannelName := utils.SanitizeTopicName(ctx.Args().Get(1))
	newChannelName := utils.SanitizeTopicName(ctx.Args().Get(2))

	c.resolvingRequest.TlfName = teamName
	c.resolvingRequest.TopicName = oldChannelName
	c.resolvingRequest.Visibility = keybase1.TLFVisibility_PRIVATE
	c.resolvingRequest.MembersType = chat1.ConversationMembersType_TEAM
	if c.resolvingRequest.TopicType, err = parseConversationTopicType(ctx); err != nil {
		return err
	}
	c.setTopicName = newChannelName

	return nil
}

func (c *CmdChatRenameChannel) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
