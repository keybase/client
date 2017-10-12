package client

import (
	"context"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

type CmdChatListChannels struct {
	libkb.Contextified

	tlfName   string
	topicType chat1.TopicType
}

func NewCmdChatListChannelsRunner(g *libkb.GlobalContext) *CmdChatListChannels {
	return &CmdChatListChannels{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatListChannels(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "list-channels",
		Usage:        "List of channels on a team",
		ArgumentHelp: "<team name>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatListChannelsRunner(g), "list-channels", c)
		},
		Flags: mustGetChatFlags("topic-type"),
	}
}

func (c *CmdChatListChannels) Run() error {
	ui := c.G().UI.GetTerminalUI()
	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.Background()
	listRes, err := chatClient.GetTLFConversationsLocal(ctx, chat1.GetTLFConversationsLocalArg{
		TlfName:     c.tlfName,
		TopicType:   c.topicType,
		MembersType: chat1.ConversationMembersType_TEAM,
	})
	if err != nil {
		return err
	}

	ui.Printf("Listing channels on %s:\n\n", c.tlfName)
	for _, c := range listRes.Convs {
		convLine := fmt.Sprintf("#%s", c.Channel)
		if c.Headline != "" {
			convLine += fmt.Sprintf(" [%s]", c.Headline)
		}
		if c.CreatorInfo != nil {
			convLine += fmt.Sprintf(" (created by: %s on: %s)", c.CreatorInfo.Username,
				c.CreatorInfo.Ctime.Time().Format("2006-01-02"))
		}
		ui.Printf(convLine + "\n")
	}

	return nil
}

func (c *CmdChatListChannels) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 1 {
		cli.ShowCommandHelp(ctx, "list-channels")
		return fmt.Errorf("incorrect usage")
	}

	c.tlfName = ctx.Args().Get(0)
	if c.topicType, err = parseConversationTopicType(ctx); err != nil {
		return err
	}
	return nil
}

func (c *CmdChatListChannels) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
