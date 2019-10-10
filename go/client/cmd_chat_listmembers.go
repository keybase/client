package client

import (
	"context"
	"fmt"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	isatty "github.com/mattn/go-isatty"
)

type CmdChatListMembers struct {
	libkb.Contextified

	json, hasTTY       bool
	resolvingRequest   chatConversationResolvingRequest
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
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: append(mustGetChatFlags("topic-type"), cli.BoolFlag{
			Name:  "j, json",
			Usage: "Output memberships as JSON",
		}),
	}
}

func (c *CmdChatListMembers) Run() error {
	ctx := context.Background()
	if c.topicName != "" && c.topicName != "general" {
		// conversation membership is based on server trust
		return c.getUntrustedConvMemberList(ctx)
	}

	// determine membership via team load
	return c.getTeamMemberList(ctx)
}

func (c *CmdChatListMembers) getUntrustedConvMemberList(ctx context.Context) error {
	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}
	inboxRes, err := chatClient.FindConversationsLocal(ctx, chat1.FindConversationsLocalArg{
		TlfName:          c.tlfName,
		MembersType:      chat1.ConversationMembersType_TEAM,
		TopicName:        c.topicName,
		TopicType:        c.topicType,
		Visibility:       keybase1.TLFVisibility_PRIVATE,
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

	ui := c.G().UI.GetTerminalUI()
	ui.Printf("Listing members in %s [#%s]:\n\n", c.tlfName, c.topicName)
	for _, memb := range inboxRes.Conversations[0].AllNames() {
		ui.Printf("%s\n", memb)
	}
	return nil
}

func (c *CmdChatListMembers) getTeamMemberList(ctx context.Context) error {
	_, conversationInfo, err := resolveConversationForBotMember(c.G(), c.resolvingRequest, c.hasTTY)
	if err != nil {
		return err
	}
	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}
	teamID, err := chatClient.TeamIDFromTLFName(ctx, chat1.TeamIDFromTLFNameArg{
		TlfName:     conversationInfo.TlfName,
		MembersType: conversationInfo.MembersType,
		TlfPublic:   conversationInfo.Visibility == keybase1.TLFVisibility_PUBLIC,
	})
	if err != nil {
		return err
	}

	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}
	details, err := cli.TeamGetByID(context.Background(), keybase1.TeamGetByIDArg{Id: teamID})
	if err != nil {
		return err
	}

	renderer := newTeamMembersRenderer(c.G(), c.json, false /*showInviteID*/)
	return renderer.output(details, conversationInfo.TlfName, false /*verbose*/)
}

func (c *CmdChatListMembers) ParseArgv(ctx *cli.Context) (err error) {

	c.json = ctx.Bool("json")
	c.tlfName = ctx.Args().Get(0)
	c.topicName = ctx.Args().Get(1)
	c.hasTTY = isatty.IsTerminal(os.Stdin.Fd())
	if c.topicType, err = parseConversationTopicType(ctx); err != nil {
		return err
	}
	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, c.tlfName); err != nil {
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
