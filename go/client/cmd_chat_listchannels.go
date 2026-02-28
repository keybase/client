package client

import (
	"context"
	"encoding/json"
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
	json      bool
}

func NewCmdChatListChannelsRunner(g *libkb.GlobalContext) *CmdChatListChannels {
	return &CmdChatListChannels{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatListChannels(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := mustGetChatFlags("topic-type")
	flags = append(flags, cli.BoolFlag{
		Name:  "j, json",
		Usage: "Output channels as JSON",
	})
	return cli.Command{
		Name:         "list-channels",
		Usage:        "List of channels on a team",
		ArgumentHelp: "<team name>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatListChannelsRunner(g), "list-channels", c)
		},
		Flags: flags,
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

	if c.json {
		b, err := json.Marshal(listRes)
		if err != nil {
			return err
		}
		ui.Printf("%s\n", string(b))
		return nil
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
		ui.Printf("%s\n", convLine)
	}
	return nil
}

func (c *CmdChatListChannels) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("incorrect usage")
	}

	c.tlfName = ctx.Args().Get(0)
	if c.topicType, err = parseConversationTopicType(ctx); err != nil {
		return err
	}

	c.json = ctx.Bool("json")
	return nil
}

func (c *CmdChatListChannels) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
