package client

import (
	"errors"
	"fmt"

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
		Name:        "balances",
		Description: "Show account balances",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "balances", c)
		},
	}
}

func (c *cmdWalletBalances) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 1 {
		return errors.New("one wallet address required, multiple found")
	} else if len(ctx.Args()) == 1 {
		c.address = ctx.Args()[0]
	}

	return nil
}

func (c *cmdWalletBalances) runForAccountID(cli stellar1.LocalClient) error {
	accountID := stellar1.AccountID(c.address)

	dui := c.G().UI.GetDumbOutputUI()
	balances, err := cli.BalancesLocal(context.Background(), accountID)
	if err != nil {
		return err
	}

	for _, balance := range balances {
		kind := balance.Asset.Type
		if balance.Asset.Type == "native" {
			kind = "XLM"
		}
		dui.Printf("%s\t%s\n", kind, balance.Amount)
	}
	return nil
}

func (c *cmdWalletBalances) runForUser(cli stellar1.LocalClient) error {
	accounts, err := cli.WalletGetLocalAccounts(context.Background())
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	for i, acc := range accounts {
		var accountName string
		if acc.Name != "" {
			accountName = fmt.Sprintf("%s (%s)", acc.Name, acc.AccountID.String())
		} else {
			accountName = acc.AccountID.String()
			if acc.IsPrimary {
				accountName += " (Primary)"
			}
		}
		dui.Printf("Balances for account %s:\n", accountName)

		for _, balance := range acc.Balance {
			localAmountStr := ""
			kind := balance.Asset.Type
			if balance.Asset.Type == "native" {
				kind = "XLM"

				if acc.LocalCurrency != "" {
					localAmount, err := acc.LocalExchangeRate.ConvertXLM(balance.Amount)
					if err == nil {
						localAmountStr = fmt.Sprintf(" (%s %s)", localAmount, string(acc.LocalCurrency))
					} else {
						c.G().Log.Warning("Unable to convert to local currency: %s", err)
					}
				}
			}
			dui.Printf("%s\t%s%s\n", kind, balance.Amount, ColorString(c.G(), "green", localAmountStr))
		}

		if i != len(accounts)-1 {
			dui.Printf("\n")
		}
	}
	return nil
}

func (c *cmdWalletBalances) Run() error {
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	if c.address == "" {
		return c.runForUser(cli)
	}
	return c.runForAccountID(cli)
}

func (c *cmdWalletBalances) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
