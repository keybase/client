package client

import (
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type CmdChatSearchBots struct {
	libkb.Contextified
	query string
	limit int
	page  int
}

func NewCmdChatSearchBotsRunner(g *libkb.GlobalContext) *CmdChatSearchBots {
	return &CmdChatSearchBots{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatSearchBots(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "search-bots",
		Usage:        "Search chat bots available on Keybase.",
		ArgumentHelp: "<query>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatSearchBotsRunner(g), "search-bots", c)
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

func (c *CmdChatSearchBots) Run() (err error) {
	cli, err := GetFeaturedBotsClient(c.G())
	if err != nil {
		return err
	}

	offset := c.limit * c.page
	res, err := cli.Search(context.Background(), keybase1.SearchArg{
		Query:  c.query,
		Limit:  c.limit,
		Offset: offset,
	})
	if err != nil {
		return err
	}
	err = displayFeaturedBots(c.G(), res.Bots)
	return err
}

func (c *CmdChatSearchBots) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 1 {
		return errors.New("usage: keybase chat search-bots <query>")
	}
	c.query = ctx.Args().Get(0)
	c.limit = ctx.Int("number")
	c.page = ctx.Int("page")
	return nil
}

func (c *CmdChatSearchBots) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
