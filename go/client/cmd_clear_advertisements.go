package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type CmdChatClearCommands struct {
	libkb.Contextified
}

func NewCmdChatClearCommandsRunner(g *libkb.GlobalContext) *CmdChatClearCommands {
	return &CmdChatClearCommands{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatClearCommands(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "clear-commands",
		Usage: "Clear any advertised commands for the logged-in user.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatClearCommandsRunner(g), "clear-commands", c)
			cl.SetNoStandalone()
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

func (c *CmdChatClearCommands) Run() error {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}
	// TODO(marcel): get filter
	if _, err = client.ClearBotCommandsLocal(context.Background(), nil); err != nil {
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
	return nil
}

func (c *CmdChatClearCommands) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
