package client

import (
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/stellarnet"
	"golang.org/x/net/context"
)

type cmdWalletBalances struct {
	libkb.Contextified
	accountID string
}

func newCmdWalletBalances(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletBalances{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:        "balances",
		Aliases:     []string{"list", "accounts"},
		Usage:       "Show account balances",
		Description: "Show account balances",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "balances", c)
		},
	}
}

func (c *cmdWalletBalances) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 1 {
		return errors.New("one Stellar address required, multiple found")
	} else if len(ctx.Args()) == 1 {
		c.accountID = ctx.Args()[0]
	}

	return nil
}

func (c *cmdWalletBalances) runForAccountID(cli stellar1.LocalClient) error {
	accountID, err := libkb.ParseStellarAccountID(c.accountID)
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	balances, err := cli.BalancesLocal(context.Background(), accountID)
	if err != nil {
		return err
	}

	for _, balance := range balances {
		if balance.Asset.IsNativeXLM() {
			dui.Printf("%s\t%s\n", "XLM", balance.Amount)
		} else {
			dui.Printf("%q\t%s\t(issued by %s)\n", balance.Asset.Code, balance.Amount, balance.Asset.Issuer)
		}
	}
	return nil
}

func (c *cmdWalletBalances) runForUser(cli stellar1.LocalClient) error {
	accounts, err := cli.WalletGetAccountsCLILocal(context.Background())
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	for i, acc := range accounts {
		var accountName string
		if acc.Name != "" {
			var isPrimary string
			if acc.IsPrimary {
				isPrimary = " (Primary)"
			}
			accountName = fmt.Sprintf("'%s' (%s)%s", acc.Name, acc.AccountID.String(), isPrimary)
		} else {
			accountName = acc.AccountID.String()
			if acc.IsPrimary {
				accountName += " (Primary)"
			}
		}
		dui.Printf("Balances for account %s:\n", accountName)

		if len(acc.Balance) == 0 {
			// If there are no balance entries the account is not on the network.
			// Make a fake entry of 0 XLM to display.
			acc.Balance = []stellar1.Balance{{
				Asset:  stellar1.AssetNative(),
				Amount: "0",
				Limit:  "",
			}}
		}
		for _, balance := range acc.Balance {
			localAmountStr := ""
			if balance.Asset.IsNativeXLM() {
				if acc.ExchangeRate != nil {
					localAmount, err := stellarnet.ConvertXLMToOutside(balance.Amount, acc.ExchangeRate.Rate)
					if err == nil {
						localAmountStr = fmt.Sprintf(" (%s %s)", string(acc.ExchangeRate.Currency), localAmount)
					} else {
						c.G().Log.Warning("Unable to convert to local currency: %s", err)
					}
				}

				dui.PrintfUnescaped("XLM\t%s%s\n", balance.Amount, ColorString(c.G(), "green", localAmountStr))
			} else {
				dui.Printf("%q\t%s\t(issued by %s)\n", balance.Asset.Code, balance.Amount, balance.Asset.Issuer)
			}
		}

		if i != len(accounts)-1 {
			dui.Printf("\n")
		}
	}
	return nil
}

func (c *cmdWalletBalances) Run() (err error) {
	defer transformStellarCLIError(&err)
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	if c.accountID == "" {
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
