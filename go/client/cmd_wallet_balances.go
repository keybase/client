package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

type cmdWalletBalances struct {
	libkb.Contextified
	address string
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
	// Temporary: use wallet address from the command line args
	if len(ctx.Args()) == 0 {
		return errors.New("wallet address argument required")
	}
	if len(ctx.Args()) > 1 {
		return errors.New("one wallet address required, multiple found")
	}

	c.address = ctx.Args()[0]
	return nil
}

func (c *cmdWalletBalances) Run() error {
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	arg := stellar1.BalancesArg{
		AccountID: stellar1.AccountID(c.address),
	}

	balances, err := cli.Balances(context.Background(), arg)
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	for _, balance := range balances {
		kind := balance.Asset.Type
		if balance.Asset.Type == "native" {
			kind = "XLM"
		}
		dui.Printf("%s\t%s\n", kind, balance.Amount)
	}

	return nil
}

func (c *cmdWalletBalances) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
