package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

// Cancel the reset pipeline
type CmdAccountResetCancel struct {
	libkb.Contextified
}

func NewCmdAccountResetCancel(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "reset-cancel",
		Usage: "Cancel the reset process for your account",
		Action: func(c *cli.Context) {
			cmd := NewCmdAccountResetCancelRunner(g)
			cl.ChooseCommand(cmd, "reset-cancel", c)
			cl.SetSkipAccountResetCheck()
		},
	}
}

func NewCmdAccountResetCancelRunner(g *libkb.GlobalContext) *CmdAccountResetCancel {
	return &CmdAccountResetCancel{Contextified: libkb.NewContextified(g)}
}

func (c *CmdAccountResetCancel) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("cancel takes no arguments")
	}
	return nil
}

func (c *CmdAccountResetCancel) Run() error {
	cli, err := GetAccountClient(c.G())
	if err != nil {
		return err
	}
	if err = cli.CancelReset(context.Background(), 0); err != nil {
		return err
	}
	ui := c.G().UI.GetDumbOutputUI()
	ui.Printf("Account reset cancelled.\n")
	return nil
}

func (c *CmdAccountResetCancel) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:    true,
		Config: true,
	}
}
