package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type cmdWalletBalances struct {
	libkb.Contextified
}

func newCmdWalletBalances(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletBalances{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name: "balances",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "balances", c)
		},
	}
}

func (c *cmdWalletBalances) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *cmdWalletBalances) Run() error {
	return nil
}

func (c *cmdWalletBalances) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
