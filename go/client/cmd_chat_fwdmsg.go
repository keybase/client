package client

import (
	"context"
	"fmt"
	"strconv"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdChatForwardMsg struct {
	libkb.Contextified
	srcResolvingRequest, dstResolvingRequest chatConversationResolvingRequest
	msgID                                    chat1.MessageID
}

func newCmdChatForwardMsg(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "forward-message",
		Usage:        "forward a message from one conversation to another",
		ArgumentHelp: "<src-conversation> <dst-conversation> <message-id>",
		Action: func(c *cli.Context) {
			cmd := &CmdChatForwardMsg{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "forward-message", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "src-channel",
				Usage: `Specify the source conversation channel.`,
			},
			cli.StringFlag{
				Name:  "dst-channel",
				Usage: `Specify the destination conversation channel.`,
			},
		},
	}
}

func (c *CmdChatForwardMsg) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 3 {
		return fmt.Errorf("must specify an source, destination, and message id")
	}
	c.srcResolvingRequest = chatConversationResolvingRequest{
		TlfName:    ctx.Args()[0],
		TopicName:  ctx.String("src-channel"),
		TopicType:  chat1.TopicType_CHAT,
		Visibility: keybase1.TLFVisibility_PRIVATE,
	}
	c.dstResolvingRequest = chatConversationResolvingRequest{
		TlfName:    ctx.Args()[1],
		TopicName:  ctx.String("dst-channel"),
		TopicType:  chat1.TopicType_CHAT,
		Visibility: keybase1.TLFVisibility_PRIVATE,
	}
	id, err := strconv.ParseUint(ctx.Args()[2], 10, 64)
	if err != nil {
		return err
	}
	c.msgID = chat1.MessageID(id)
	return nil
}

func (c *CmdChatForwardMsg) resolve(ctx context.Context, resolver *chatConversationResolver, request chatConversationResolvingRequest) (*chat1.ConversationLocal, error) {
	if err := annotateResolvingRequest(c.G(), &request); err != nil {
		return nil, err
	}
	conv, _, err := resolver.Resolve(ctx, request, chatConversationResolvingBehavior{
		CreateIfNotExists: true,
		MustNotExist:      false,
		Interactive:       true,
		IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	return conv, err
}

func (c *CmdChatForwardMsg) Run() error {
	ctx := context.Background()
	resolver, err := newChatConversationResolver(c.G())
	if err != nil {
		return err
	}
	srcConv, err := c.resolve(ctx, resolver, c.srcResolvingRequest)
	if err != nil {
		return err
	}
	dstConv, err := c.resolve(ctx, resolver, c.dstResolvingRequest)
	if err != nil {
		return err
	}
	_, err = resolver.ChatClient.ForwardMessage(ctx, chat1.ForwardMessageArg{
		SrcConvID:        srcConv.GetConvID(),
		DstConvID:        dstConv.GetConvID(),
		MsgID:            c.msgID,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		Title:            "",
	})
	return err
}

func (c *CmdChatForwardMsg) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
