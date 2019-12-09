package client

import (
	"fmt"
	"strconv"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/flexibletable"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

const defaultFeaturedBotsLimit = 10

type CmdChatFeaturedBots struct {
	libkb.Contextified
	limit int
	page  int
}

func NewCmdChatFeaturedBotsRunner(g *libkb.GlobalContext) *CmdChatFeaturedBots {
	return &CmdChatFeaturedBots{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatFeaturedBots(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "featured-bots",
		Usage: "List featured chat bots available on Keybase.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatFeaturedBotsRunner(g), "featured-bots", c)
			cl.SetNoStandalone()
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: []cli.Flag{
			cli.IntFlag{
				Name:  "n, number",
				Usage: fmt.Sprintf("Number of bots to display, defaults to %d", defaultFeaturedBotsLimit),
				Value: defaultFeaturedBotsLimit,
			},
			cli.IntFlag{
				Name:  "p, page",
				Usage: "page",
			},
		},
	}
}

func (c *CmdChatFeaturedBots) Run() (err error) {
	cli, err := GetFeaturedBotsClient(c.G())
	if err != nil {
		return err
	}

	offset := c.limit * c.page
	res, err := cli.FeaturedBots(context.Background(), keybase1.FeaturedBotsArg{
		Limit:  c.limit,
		Offset: offset,
	})
	if err != nil {
		return err
	}
	err = displayFeaturedBots(c.G(), res.Bots)
	return err
}

func (c *CmdChatFeaturedBots) ParseArgv(ctx *cli.Context) (err error) {
	c.limit = ctx.Int("number")
	c.page = ctx.Int("page")
	return nil
}

func (c *CmdChatFeaturedBots) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func displayFeaturedBots(g *libkb.GlobalContext, bots []keybase1.FeaturedBot) error {
	ui := g.UI.GetTerminalUI()
	if len(bots) == 0 {
		ui.Output("Not bots found\n")
		return nil
	}

	ui.Output("To add a bot see `keybase chat add-bot-member --help`\n")
	table := &flexibletable.Table{}
	for i, bot := range bots {
		displayName := bot.BotUsername
		if bot.BotAlias != "" {
			displayName = fmt.Sprintf("%s (%s)", bot.BotAlias, bot.BotUsername)
		}
		err := table.Insert(flexibletable.Row{
			flexibletable.Cell{
				Frame:     [2]string{"[", "]"},
				Alignment: flexibletable.Right,
				Content:   flexibletable.SingleCell{Item: strconv.Itoa(i + 1)},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: displayName},
			},
			flexibletable.Cell{
				Alignment: flexibletable.Left,
				Content:   flexibletable.SingleCell{Item: bot.Description},
			},
		})
		if err != nil {
			return err
		}
	}
	w, _ := ui.TerminalSize()
	if err := table.Render(ui.OutputWriter(), " ", w, []flexibletable.ColumnConstraint{
		5,                                 // visualIndex
		64,                                // displayName
		flexibletable.ExpandableWrappable, // description
	}); err != nil {
		return fmt.Errorf("rendering conversation info list view error: %v\n", err)
	}
	return nil
}
