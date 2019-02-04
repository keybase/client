package client

import (
	"errors"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

type cmdWalletSetCurrency struct {
	libkb.Contextified
	address  string
	currency string
}

func newCmdWalletSetCurrency(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletSetCurrency{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "set-currency",
		Usage:        "Set stellar account display currency",
		ArgumentHelp: "<account ID>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "set-currency", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "currency",
				Usage: "Currency code to use (e.g. USD, EUR)",
			},
		},
	}
}

func (c *cmdWalletSetCurrency) ParseArgv(ctx *cli.Context) error {
	// Temporary: use wallet address from the command line args
	if len(ctx.Args()) == 0 {
		return errors.New("wallet address argument required")
	}
	if len(ctx.Args()) > 1 {
		return errors.New("one wallet address required, multiple found")
	}

	c.currency = strings.ToUpper(ctx.String("currency"))
	if c.currency == "" {
		return errors.New("currency required via --currency flag.")
	}

	c.address = ctx.Args()[0]
	return nil
}

func (c *cmdWalletSetCurrency) Run() (err error) {
	defer transformStellarCLIError(&err)
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	accountID := stellar1.AccountID(c.address)
	return cli.SetDisplayCurrency(context.Background(), stellar1.SetDisplayCurrencyArg{
		AccountID: accountID,
		Currency:  c.currency,
	})
}

func (c *cmdWalletSetCurrency) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
