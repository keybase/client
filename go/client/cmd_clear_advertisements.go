package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type CmdChatClearAdvertisements struct {
	libkb.Contextified
}

func NewCmdChatClearAdvertisementsRunner(g *libkb.GlobalContext) *CmdChatClearAdvertisements {
	return &CmdChatClearAdvertisements{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatClearAdvertisements(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "clear-advertisements",
		Usage: "Clear any advertised commands for the logged-in user.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatClearAdvertisementsRunner(g), "clear-advertisements", c)
			cl.SetNoStandalone()
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

func (c *CmdChatClearAdvertisements) Run() error {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}
	if _, err = client.ClearBotCommandsLocal(context.Background()); err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	_, err = dui.Printf("Cleared bot commands successfully.\n")
	return err
}

func (c *CmdChatClearAdvertisements) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("clear-advertisements")
	}
	return nil
}

func (c *CmdChatClearAdvertisements) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
