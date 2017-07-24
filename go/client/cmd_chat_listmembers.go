package client

import (
	"context"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdChatListMembers struct {
	libkb.Contextified

	tlfName, topicName string
	topicType          chat1.TopicType
}

func NewCmdChatListMembersRunner(g *libkb.GlobalContext) *CmdChatListMembers {
	return &CmdChatListMembers{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatListMembers(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "list-members",
		Usage:        "List members of a chat channel (must be a member of that channel)",
		ArgumentHelp: "[conversation [channel name]]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatListMembersRunner(g), "list-members", c)
		},
		Flags: mustGetChatFlags("topic-type"),
	}
}

func (c *CmdChatListMembers) Run() error {
	ui := c.G().UI.GetTerminalUI()
	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.Background()
	inboxRes, err := chatClient.FindConversationsLocal(ctx, chat1.FindConversationsLocalArg{
		TlfName:          c.tlfName,
		MembersType:      chat1.ConversationMembersType_TEAM,
		TopicName:        c.topicName,
		TopicType:        c.topicType,
		Visibility:       chat1.TLFVisibility_PRIVATE,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return err
	}
	if len(inboxRes.Conversations) == 0 {
		return fmt.Errorf("failed to find any matching conversation")
	}
	if len(inboxRes.Conversations) > 1 {
		return fmt.Errorf("ambiguous channel description, more than one conversation matches")
	}

	ui.Printf("Listing members in %s [#%s]:\n\n", c.tlfName, c.topicName)
	for _, memb := range inboxRes.Conversations[0].Info.WriterNames {
		ui.Printf("%s\n", memb)
	}

	return nil
}

func (c *CmdChatListMembers) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 2 {
		cli.ShowCommandHelp(ctx, "list-members")
		return fmt.Errorf("Incorrect usage.")
	}

	c.tlfName = ctx.Args().Get(0)
	c.topicName = ctx.Args().Get(1)
	if c.topicType, err = parseConversationTopicType(ctx); err != nil {
		return err
	}
	return nil
}

func (c *CmdChatListMembers) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
