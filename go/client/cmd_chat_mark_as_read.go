package client

import (
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	isatty "github.com/mattn/go-isatty"
	context "golang.org/x/net/context"
)

type CmdChatMarkAsRead struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	hasTTY           bool
}

func NewCmdChatMarkAsReadRunner(g *libkb.GlobalContext) *CmdChatMarkAsRead {
	return &CmdChatMarkAsRead{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatMarkAsRead(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "mark-as-read",
		Usage:        "Mark a conversation or entire team as read.",
		ArgumentHelp: "[conversation]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatMarkAsReadRunner(g), "mark-as-read", c)
			cl.SetNoStandalone()
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: getConversationResolverFlags(),
	}
}

func (c *CmdChatMarkAsRead) Run() (err error) {
	resolver, conv, err := resolveToConversation(c.G(), c.resolvingRequest, c.hasTTY)
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	if conv.Info.MembersType == chat1.ConversationMembersType_TEAM && conv.Info.TopicName == globals.DefaultTeamTopic {
		_, err := resolver.ChatClient.MarkTLFAsReadLocal(context.TODO(), chat1.MarkTLFAsReadLocalArg{
			TlfID: conv.Info.Triple.Tlfid,
		})
		if err != nil {
			return err
		}
		_, err = dui.Printf("Marked all conversations in %q as read.\n", conv.Info.TlfName)
		return err
	}

	_, err = resolver.ChatClient.MarkAsReadLocal(context.TODO(), chat1.MarkAsReadLocalArg{
		ConversationID: conv.Info.Id,
		MsgID:          &conv.ReaderInfo.MaxMsgid,
	})
	if err != nil {
		return err
	}
	name := conv.Info.TlfName
	switch conv.Info.MembersType {
	case chat1.ConversationMembersType_TEAM:
		name += "#" + conv.Info.TopicName
	default:
	}
	_, err = dui.Printf("Marked %q as read.\n", name)
	return err
}

func (c *CmdChatMarkAsRead) ParseArgv(ctx *cli.Context) (err error) {
	c.hasTTY = isatty.IsTerminal(os.Stdin.Fd())

	var tlfName string
	// Get the TLF name from the first position arg
	if len(ctx.Args()) >= 1 {
		tlfName = ctx.Args().Get(0)
	}
	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
		return err
	}
	return nil
}

func (c *CmdChatMarkAsRead) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
