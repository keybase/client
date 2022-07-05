package client

import (
	"fmt"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	isatty "github.com/mattn/go-isatty"
	context "golang.org/x/net/context"
)

type CmdChatConvInfo struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	hasTTY           bool
}

func NewCmdChatConvInfoRunner(g *libkb.GlobalContext) *CmdChatConvInfo {
	return &CmdChatConvInfo{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatConvInfo(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "conv-info",
		Usage:        "Get information about a conversation",
		ArgumentHelp: "[conversation]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatConvInfoRunner(g), "conv-info", c)
			cl.SetNoStandalone()
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: getConversationResolverFlags(),
	}
}

func (c CmdChatConvInfo) resolveToConversation(g *libkb.GlobalContext, resolvingRequest chatConversationResolvingRequest,
	hasTTY bool) (res chat1.ConversationInfoLocal, err error) {
	ui := NewChatCLIUI(g)
	protocols := []rpc.Protocol{
		chat1.ChatUiProtocol(ui),
	}
	if err := RegisterProtocolsWithContext(protocols, g); err != nil {
		return res, err
	}
	// if no tlfname specified, request one
	if resolvingRequest.TlfName == "" {
		resolvingRequest.TlfName, err = g.UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatTLFName,
			"Specify a team name, a single receiving user, or a comma-separated list of users (e.g. alice,bob,charlie) to continue: ")
		if err != nil {
			return res, err
		}
		if resolvingRequest.TlfName == "" {
			return res, fmt.Errorf("no user or team name specified")
		}
	}

	if err = annotateResolvingRequest(g, &resolvingRequest); err != nil {
		return res, err
	}

	resolver, err := newChatConversationResolver(g)
	if err != nil {
		return res, err
	}
	conversation, _, err := resolver.Resolve(context.TODO(), resolvingRequest, chatConversationResolvingBehavior{
		CreateIfNotExists: false,
		MustNotExist:      false,
		Interactive:       hasTTY,
		IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	switch err.(type) {
	case nil:
	case libkb.ResolutionError:
		return res, fmt.Errorf("could not resolve `%s` into Keybase user(s) or a team", resolvingRequest.TlfName)
	default:
		return res, err
	}
	return conversation.Info, nil
}

func (c *CmdChatConvInfo) Run() error {
	info, err := c.resolveToConversation(c.G(), c.resolvingRequest, c.hasTTY)
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	var topicType string
	if info.Triple.TopicType != chat1.TopicType_CHAT {
		topicType = fmt.Sprintf(" (%s)", info.Triple.TopicType)
	}
	_, err = dui.Printf("ConversationName: %s%s\nConversationID: %v\nConvIDShort: %v\n",
		utils.FormatConversationName(info, c.G().Env.GetUsername().String()), topicType, info.Id, info.Id.DbShortFormString())
	return err
}

func (c *CmdChatConvInfo) ParseArgv(ctx *cli.Context) (err error) {
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

func (c *CmdChatConvInfo) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
