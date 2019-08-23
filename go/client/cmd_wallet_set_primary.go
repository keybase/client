package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

type cmdWalletSetPrimary struct {
	libkb.Contextified
	accountID string
}

func newCmdWalletSetPrimary(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletSetPrimary{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "set-primary",
		Usage:        "Set a stellar account to be your primary account (for sending and receiving)",
		ArgumentHelp: "<account id>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "set-primary", c)
		},
	}
}

func (c *cmdWalletSetPrimary) ParseArgv(ctx *cli.Context) error {
	c.accountID = ctx.Args().First()
	if len(c.accountID) == 0 {
		return errors.New("set-primary requires a stellar account ID")
	}
	return nil
}

func (c *cmdWalletSetPrimary) Run() (err error) {
	defer transformStellarCLIError(&err)
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	arg := stellar1.SetWalletAccountAsDefaultLocalArg{
		AccountID: stellar1.AccountID(c.accountID),
	}

	if _, err := cli.SetWalletAccountAsDefaultLocal(context.Background(), arg); err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	ui.PrintfUnescaped("Wallet account %s set to %s.\n", ColorString(c.G(), "yellow", c.accountID), ColorString(c.G(), "green", "primary"))

	return nil
}

func (c *cmdWalletSetPrimary) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
