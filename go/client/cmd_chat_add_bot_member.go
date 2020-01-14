package client

import (
	"fmt"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	isatty "github.com/mattn/go-isatty"
	context "golang.org/x/net/context"
)

type CmdChatAddBotMember struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	username         string
	role             keybase1.TeamRole
	botSettings      *keybase1.TeamBotSettings
	hasTTY           bool
}

func NewCmdChatAddBotMemberRunner(g *libkb.GlobalContext) *CmdChatAddBotMember {
	return &CmdChatAddBotMember{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatAddBotMember(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := append(getConversationResolverFlags(), botSettingsFlags...)
	flags = append(flags, cli.StringFlag{
		Name:  "u, user",
		Usage: "username",
	}, cli.StringFlag{
		Name:  "r, role",
		Usage: "team role (bot, restrictedbot)",
	})
	return cli.Command{
		Name:         "add-bot-member",
		Usage:        "Add a bot or a restricted bot to a conversation.",
		ArgumentHelp: "[conversation]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatAddBotMemberRunner(g), "add-bot-member", c)
			cl.SetNoStandalone()
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: flags,
	}
}

func resolveConversationForBotMember(g *libkb.GlobalContext, resolvingRequest chatConversationResolvingRequest,
	hasTTY bool) (resolver *chatConversationResolver, res chat1.ConversationInfoLocal, err error) {
	ui := NewChatCLIUI(g)
	protocols := []rpc.Protocol{
		chat1.ChatUiProtocol(ui),
	}
	if err := RegisterProtocolsWithContext(protocols, g); err != nil {
		return nil, res, err
	}
	// if no tlfname specified, request one
	if resolvingRequest.TlfName == "" {
		resolvingRequest.TlfName, err = g.UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatTLFName,
			"Specify a team name, a single receiving user, or a comma-separated list of users (e.g. alice,bob,charlie) to continue: ")
		if err != nil {
			return nil, res, err
		}
		if resolvingRequest.TlfName == "" {
			return nil, res, fmt.Errorf("no user or team name specified")
		}
	}

	if err = annotateResolvingRequest(g, &resolvingRequest); err != nil {
		return nil, res, err
	}

	resolver, err = newChatConversationResolver(g)
	if err != nil {
		return nil, res, err
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
		return nil, res, fmt.Errorf("could not resolve `%s` into Keybase user(s) or a team", resolvingRequest.TlfName)
	default:
		return nil, res, err
	}
	conversationInfo := conversation.Info

	if conversationInfo.MembersType == chat1.ConversationMembersType_KBFS {
		return nil, res, fmt.Errorf("Cannot have bot members in a KBFS type chat.")
	}
	return resolver, conversationInfo, nil
}

func (c *CmdChatAddBotMember) Run() (err error) {
	resolver, conversationInfo, err := resolveConversationForBotMember(c.G(), c.resolvingRequest, c.hasTTY)
	if err != nil {
		return err
	}

	if err := ValidateBotSettingsConvs(c.G(), conversationInfo.TlfName, conversationInfo.MembersType, c.botSettings); err != nil {
		return err
	}

	if err = resolver.ChatClient.AddBotMember(context.TODO(), chat1.AddBotMemberArg{
		ConvID:      conversationInfo.Id,
		Username:    c.username,
		Role:        c.role,
		BotSettings: c.botSettings,
	}); err != nil {
		return err
	}
	return nil
}

func (c *CmdChatAddBotMember) ParseArgv(ctx *cli.Context) (err error) {
	c.role, err = ParseRole(ctx)
	if err != nil {
		return err
	}
	c.username, err = ParseUser(ctx)
	if err != nil {
		return err
	}

	if c.role.IsRestrictedBot() {
		c.botSettings = ParseBotSettings(ctx)
	}
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

func (c *CmdChatAddBotMember) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
