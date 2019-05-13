package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdChatReAddMember struct {
	libkb.Contextified
	name             string
	user             string
	resolvingRequest chatConversationResolvingRequest
}

func NewCmdChatReAddMemberRunner(g *libkb.GlobalContext) *CmdChatReAddMember {
	return &CmdChatReAddMember{Contextified: libkb.NewContextified(g)}
}

func newCmdChatReAddMember(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "readd-member",
		Usage:        "Re-add a member to chat after they reset account",
		ArgumentHelp: "<conversation> <username>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatReAddMemberRunner(g), "readd-member", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: mustGetChatFlags("topic-type"),
	}
}

func (c *CmdChatReAddMember) Run() error {
	ctx := context.TODO()
	c.G().StartStandaloneChat()
	resolver, err := newChatConversationResolver(c.G())
	if err != nil {
		return err
	}
	// force imp team, since anything else doesn't make sense
	c.resolvingRequest.MembersType = chat1.ConversationMembersType_IMPTEAMNATIVE
	conversation, _, err := resolver.Resolve(ctx, c.resolvingRequest, chatConversationResolvingBehavior{
		CreateIfNotExists: false,
		MustNotExist:      false,
		Interactive:       false,
		IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return err
	}
	err = resolver.ChatClient.AddTeamMemberAfterReset(ctx, chat1.AddTeamMemberAfterResetArg{
		Username: c.user,
		ConvID:   conversation.GetConvID(),
	})
	if err == nil {
		dui := c.G().UI.GetDumbOutputUI()
		dui.Printf("Success!\n")
		return nil
	}
	return err
}

func (c *CmdChatReAddMember) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 2 {
		return errors.New("readd-member takes two arguments")
	}
	c.name = ctx.Args().Get(0)
	c.user = ctx.Args().Get(1)
	c.resolvingRequest, err = parseConversationResolvingRequest(ctx, c.name)
	if err != nil {
		return err
	}
	return nil
}

func (c *CmdChatReAddMember) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
