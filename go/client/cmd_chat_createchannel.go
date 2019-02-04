package client

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdChatCreateChannel struct {
	libkb.Contextified
	teamName    string
	channelName string
	topicType   chat1.TopicType
}

func NewCmdChatCreateChannelRunner(g *libkb.GlobalContext) *CmdChatCreateChannel {
	return &CmdChatCreateChannel{Contextified: libkb.NewContextified(g)}
}

func newCmdChatCreateChannel(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "create-channel",
		Usage:        "Create a channel",
		ArgumentHelp: "<team name> <channel name>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatCreateChannelRunner(g), "create-channel", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: mustGetChatFlags("topic-type"),
	}
}

func (c *CmdChatCreateChannel) Run() error {
	c.G().StartStandaloneChat()
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

	_, err = resolver.create(context.Background(), req)

	dui := c.G().UI.GetDumbOutputUI()
	if err == nil {
		dui.Printf("Success!\n")
		return nil
	}

	switch err.(type) {
	case libkb.KeyMaskNotFoundError:
		// implied admin tried to create a channel
		dui.Printf("Failed to create the channel %q\n\n", c.channelName)
		dui.Printf("To edit %s's channels, you must join the team.\n", c.teamName)
		dui.Printf("Try `keybase team add-member %s --user=%s --role=admin`\n\n", c.teamName, c.G().Env.GetUsername())
		return nil
	}

	return err
}

func (c *CmdChatCreateChannel) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 2 {
		return errors.New("create channel takes two arguments")
	}

	c.teamName = ctx.Args().Get(0)
	c.channelName = ctx.Args().Get(1)

	var err error
	c.topicType, err = parseConversationTopicType(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdChatCreateChannel) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
