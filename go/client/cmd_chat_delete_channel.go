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
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type CmdChatDeleteChannel struct {
	libkb.Contextified

	resolvingRequest chatConversationResolvingRequest
}

func NewCmdChatDeleteChannelRunner(g *libkb.GlobalContext) *CmdChatDeleteChannel {
	return &CmdChatDeleteChannel{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatDeleteChannel(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "delete-channel",
		Usage:        "Delete a channel",
		ArgumentHelp: "<team name> <channel name>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatDeleteChannelRunner(g), "delete-channel", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: mustGetChatFlags("topic-type"),
	}
}

func (c *CmdChatDeleteChannel) Run() error {
	ui := NewChatCLIUI(c.G())
	protocols := []rpc.Protocol{
		chat1.ChatUiProtocol(ui),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	resolver, err := newChatConversationResolver(c.G())
	if err != nil {
		return err
	}

	ctx := context.Background()
	conv, _, err := resolver.Resolve(ctx, c.resolvingRequest, chatConversationResolvingBehavior{
		CreateIfNotExists: false,
		MustNotExist:      false,
		Interactive:       false,
		IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return err
	}

	_, err = resolver.ChatClient.DeleteConversationLocal(ctx, chat1.DeleteConversationLocalArg{
		ConvID:      conv.GetConvID(),
		ChannelName: c.resolvingRequest.TopicName,
	})
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdChatDeleteChannel) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 2 {
		return fmt.Errorf("wrong number of arguments")
	}
	teamName := ctx.Args().Get(0)
	topicName := ctx.Args().Get(1)

	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, teamName); err != nil {
		return err
	}

	// Force team for now
	c.resolvingRequest.MembersType = chat1.ConversationMembersType_TEAM
	c.resolvingRequest.Visibility = keybase1.TLFVisibility_PRIVATE
	c.resolvingRequest.TopicName = utils.SanitizeTopicName(topicName)

	return nil
}

func (c *CmdChatDeleteChannel) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
