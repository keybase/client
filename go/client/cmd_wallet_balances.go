package client

import (
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
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

func (c *cmdWalletBalances) printBalance(dui libkb.DumbOutputUI, balance stellar1.Balance, xchgRate *stellar1.OutsideExchangeRate) {
	localAmountStr := ""
	if balance.Asset.IsNativeXLM() {
		if xchgRate != nil {
			localAmount, err := stellarnet.ConvertXLMToOutside(balance.Amount, xchgRate.Rate)
			if err == nil {
				localAmountStr = fmt.Sprintf(" (%s %s)", string(xchgRate.Currency), localAmount)
			} else {
				c.G().Log.Warning("Unable to convert to local currency: %s", err)
			}
		}

		dui.PrintfUnescaped("XLM\t%s%s\n", balance.Amount, ColorString(c.G(), "green", localAmountStr))
	} else {
		dui.Printf("%s\t%s\t(issued by: %s, %s)\n", balance.Asset.Code, balance.Amount, stellar.FormatAssetIssuerString(balance.Asset), balance.Asset.Issuer)
	}
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

	var xchgRate *stellar1.OutsideExchangeRate
	accountCurrency, err := cli.GetDisplayCurrencyLocal(context.Background(), stellar1.GetDisplayCurrencyLocalArg{
		AccountID: &accountID,
	})
	if err == nil {
		// Ignore error - GetDisplayCurrencyLocal will error out if we don't
		// own the account. In that case we just skip currency conversion but
		// still display balances.
		rate, err := cli.ExchangeRateLocal(context.Background(), accountCurrency.Code)
		if err != nil {
			c.G().Log.Warning("Unable to get exchange rate for %q: %s", accountCurrency.Code, err)
		} else {
			xchgRate = &rate
		}
	}

	for _, balance := range balances {
		c.printBalance(dui, balance, xchgRate)
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
			accountName = fmt.Sprintf("'%s' (%s)%s", acc.Name, acc.AccountID, isPrimary)
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
			c.printBalance(dui, balance, acc.ExchangeRate)
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
