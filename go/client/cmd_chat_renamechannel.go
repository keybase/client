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

type CmdChatRenameChannel struct {
	libkb.Contextified

	resolvingRequest chatConversationResolvingRequest
	setTopicName     string
	nonBlock         bool
	team             bool
}

func NewCmdChatRenameChannelRunner(g *libkb.GlobalContext) *CmdChatRenameChannel {
	return &CmdChatRenameChannel{Contextified: libkb.NewContextified(g)}
}

func newCmdChatRenameChannel(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "rename-channel",
		Usage:        "Rename a conversation channel",
		ArgumentHelp: "<team name> <new channel name>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatRenameChannelRunner(g), "rename-channel", c)
		},
		Flags: append(getConversationResolverFlags(),
			mustGetChatFlags("set-channel", "nonblock")...),
	}
}

func (c *CmdChatRenameChannel) Run() error {
	c.G().StartStandaloneChat()
	return chatSend(context.TODO(), c.G(), ChatSendArg{
		resolvingRequest: c.resolvingRequest,
		setTopicName:     c.setTopicName,
		nonBlock:         c.nonBlock,
		team:             true,
		message:          "",
		setHeadline:      "",
		clearHeadline:    false,
		hasTTY:           true,
	})
}

func (c *CmdChatRenameChannel) ParseArgv(ctx *cli.Context) (err error) {
	c.setTopicName = utils.SanitizeTopicName(ctx.String("set-channel"))
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
	c.resolvingRequest.MembersType = chat1.ConversationMembersType_TEAM
	if c.resolvingRequest.Visibility == keybase1.TLFVisibility_ANY {
		c.resolvingRequest.Visibility = keybase1.TLFVisibility_PRIVATE
	}
	if c.setTopicName == "" {
		return fmt.Errorf("Must supply non-empty channel name")
	}
	if len(ctx.Args()) > 1 {
		return fmt.Errorf("cannot send text message and set channel name simultaneously")
	}

	return nil
}

func (c *CmdChatRenameChannel) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
