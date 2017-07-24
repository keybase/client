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

type CmdChatLeaveChannel struct {
	libkb.Contextified

	resolvingRequest chatConversationResolvingRequest
}

func NewCmdChatLeaveChannelRunner(g *libkb.GlobalContext) *CmdChatLeaveChannel {
	return &CmdChatLeaveChannel{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatLeaveChannel(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "leave-channel",
		Usage:        "Leave a conversation channel",
		ArgumentHelp: "[conversation [channel name]]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatLeaveChannelRunner(g), "leave-channel", c)
		},
		Flags: mustGetChatFlags("topic-type"),
	}
}

func (c *CmdChatLeaveChannel) Run() error {
	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.Background()
	resolver := &chatConversationResolver{G: c.G(), ChatClient: chatClient}
	conv, _, err := resolver.Resolve(ctx, c.resolvingRequest, chatConversationResolvingBehavior{
		CreateIfNotExists: false,
		Interactive:       false,
		IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return err
	}

	_, err = chatClient.LeaveConversationLocal(ctx, conv.GetConvID())
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdChatLeaveChannel) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 2 {
		cli.ShowCommandHelp(ctx, "join-channel")
		return fmt.Errorf("Incorrect usage.")
	}
	teamName := ctx.Args().Get(0)
	topicName := ctx.Args().Get(1)

	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, teamName); err != nil {
		return err
	}

	// Force team for now
	c.resolvingRequest.MembersType = chat1.ConversationMembersType_TEAM
	c.resolvingRequest.Visibility = chat1.TLFVisibility_PRIVATE
	c.resolvingRequest.TopicName = utils.SanitizeTopicName(topicName)

	return nil
}

func (c *CmdChatLeaveChannel) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
