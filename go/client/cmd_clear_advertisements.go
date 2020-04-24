package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdChatClearCommands struct {
	libkb.Contextified
	filter               bool
	adType               chat1.BotCommandsAdvertisementTyp
	teamName             string
	convResolvingRequest chatConversationResolvingRequest
}

func NewCmdChatClearCommandsRunner(g *libkb.GlobalContext) *CmdChatClearCommands {
	return &CmdChatClearCommands{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatClearCommands(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := getConversationResolverFlags()
	flags = append(flags, cli.StringFlag{
		Name:  "team-name",
		Usage: "Specify a team",
	}, cli.StringFlag{
		Name:  "type",
		Usage: "Specify an advertisement type. The valid values are \"public\", \"teammembers\", \"teamconvs\", \"conv\"",
	})
	return cli.Command{
		Name:  "clear-commands",
		Usage: "Clear any advertised commands for the logged-in user.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatClearCommandsRunner(g), "clear-commands", c)
			cl.SetNoStandalone()
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags:       flags,
		Description: chatClearCommandsDoc,
	}
}

func (c *CmdChatClearCommands) Run() error {
	ctx := context.Background()
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	var filter *chat1.ClearBotCommandsFilter
	if c.filter {
		var teamName *string
		var convID *chat1.ConversationID
		switch c.adType {
		case chat1.BotCommandsAdvertisementTyp_PUBLIC:
		case chat1.BotCommandsAdvertisementTyp_TLFID_CONVS, chat1.BotCommandsAdvertisementTyp_TLFID_MEMBERS:
			teamName = &c.teamName
		case chat1.BotCommandsAdvertisementTyp_CONV:
			resolver, err := newChatConversationResolver(c.G())
			if err != nil {
				return err
			}
			if err = annotateResolvingRequest(c.G(), &c.convResolvingRequest); err != nil {
				return err
			}
			conversation, _, err := resolver.Resolve(ctx, c.convResolvingRequest, chatConversationResolvingBehavior{
				CreateIfNotExists: false,
				MustNotExist:      false,
				Interactive:       false,
				IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
			})
			if err != nil {
				return err
			}
			filterConvID := conversation.GetConvID()
			convID = &filterConvID
		}
		filter = &chat1.ClearBotCommandsFilter{
			Typ:      c.adType,
			TeamName: teamName,
			ConvID:   convID,
		}
	}
	if _, err = client.ClearBotCommandsLocal(context.Background(), filter); err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	_, err = dui.Printf("Cleared bot commands successfully.\n")
	return err
}

func (c *CmdChatClearCommands) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("clear-commands")
	}
	typString := ctx.String("type")
	if typString != "" {
		c.filter = true
		c.adType, err = chat1.GetAdvertTyp(typString)
		if err != nil {
			return err
		}
		c.teamName = ctx.String("team-name")
		channel := ctx.String("channel")
		switch c.adType {
		case chat1.BotCommandsAdvertisementTyp_PUBLIC:
			if c.teamName != "" {
				return fmt.Errorf("--team-name is unexpected for type %q", typString)
			} else if channel != "" {
				return fmt.Errorf("--channel is unexpected for type %q", typString)
			}
		case chat1.BotCommandsAdvertisementTyp_TLFID_CONVS, chat1.BotCommandsAdvertisementTyp_TLFID_MEMBERS:
			if c.teamName == "" {
				return fmt.Errorf("--team-name required for type %q", typString)
			} else if channel != "" {
				return fmt.Errorf("--channel is unexpected for type %q", typString)
			}
		case chat1.BotCommandsAdvertisementTyp_CONV:
			if c.teamName == "" {
				return fmt.Errorf("--team-name required for type %q", typString)
			}
			if c.convResolvingRequest, err = parseConversationResolvingRequest(ctx, c.teamName); err != nil {
				return err
			}
		}
	} else if ctx.NumFlags() != 0 {
		return fmt.Errorf("no flags are expected when a --type is not specified")
	}
	return nil
}

func (c *CmdChatClearCommands) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

const chatClearCommandsDoc = `"keybase chat clear-commands" allows you to clear advertised commands for the logged-in user

EXAMPLES:

Clear all commands advertised by the logged-in user:

    keybase chat clear-commands

Clear all commands advertised for a specific conversation by the logged-in user:

    keybase chat clear-commands --type "conv" --team-name treehouse --channel random
`
