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

func (c *cmdWalletBalances) Run() error {
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	var accounts []stellar1.BundleEntry
	if c.address != "" {
		accounts = append(accounts, stellar1.BundleEntry{
			AccountID: stellar1.AccountID(c.address),
		})
	} else {
		accounts, err = cli.WalletGetPublicKeys(context.Background())
		if err != nil {
			return err
		}
	}

	dui := c.G().UI.GetDumbOutputUI()
	for i, bundle := range accounts {
		balances, err := cli.BalancesLocal(context.Background(), bundle.AccountID)
		if err != nil {
			return err
		}

		if c.address == "" {
			// Only print headers when dealing with multiple accounts when
			// specific address is not supplied. Otherwise default to just
			// printing balances.
			var accountName string
			if bundle.Name != "" {
				accountName = fmt.Sprintf("%s (%s)", bundle.Name, bundle.AccountID.String())
			} else {
				accountName = bundle.AccountID.String()
				if bundle.IsPrimary {
					accountName += " (Primary)"
				}
			}
			dui.Printf("Balances for account %s:\n", accountName)
		}

		for _, localBalance := range balances {
			asset := localBalance.Balance.Asset
			kind := asset.Type
			if asset.Type == "native" {
				kind = "XLM"
			}
			localValue := ""
			if localBalance.Currency != "" && localBalance.Value != "" {
				localValue = fmt.Sprintf(" (%s %s)", localBalance.Value, localBalance.Currency)
			}
			dui.Printf("%s\t%s%s\n", kind, localBalance.Balance.Amount, localValue)
		}

		if i != len(accounts)-1 {
			dui.Printf("\n")
		}
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
