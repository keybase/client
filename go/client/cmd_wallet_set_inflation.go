package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

type cmdWalletSetInflation struct {
	libkb.Contextified
	accountID   string
	destination string
}

func newCmdWalletSetInflation(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletSetInflation{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "set-inflation",
		Usage:        "Set inflation destination address for an account",
		ArgumentHelp: "<account id> <destination address or label>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "set-inflation", c)
		},
		Description: `Read more about Stellar inflation payouts:
   https://www.stellar.org/developers/guides/concepts/inflation.html

   Destination can be either a user-chosen address (any Stellar account ID),
   or one of the following labels:

   * "lumenaut" - Sets account's inflation destination to Lumenaut Pool. Read more
     on https://pool.lumenaut.net/

   * "self" - Sets inflation destination to the source account ID.

   Inflation destination cannot be removed or cleared from the account right
   now, but if you want to stop contributing to the currently set destination,
   use the "self" option.

     keybase wallet set-inflation <account id> self
`,
	}
}

func (c *cmdWalletSetInflation) ParseArgv(ctx *cli.Context) error {
	args := ctx.Args()
	if len(args) != 2 {
		return fmt.Errorf("Expecting two arguments")
	}
	c.accountID = args[0]
	c.destination = args[1]
	return nil
}

func getInflationDestinationAddrFromString(cli stellar1.LocalClient, accountID stellar1.AccountID,
	destination string) (res stellar1.AccountID, err error) {
	inputAcc, err := libkb.ParseStellarAccountID(destination)
	if err == nil {
		// User passed destination AccountID
		return inputAcc, nil
	}
	// Something else, we have to figure out what it is
	if destination == "self" {
		return accountID, nil
	}

	// Might be a tag for predefined destination.
	destinations, err := cli.GetPredefinedInflationDestinationsLocal(context.Background(), 0)
	if err != nil {
		return res, err
	}

	for _, dest := range destinations {
		if string(dest.Tag) == destination {
			return dest.AccountID, nil
		}
	}

	return res, fmt.Errorf(
		"unknown inflation destination %q: not an account ID or known destination name",
		destination)
}

func (c *cmdWalletSetInflation) Run() (err error) {
	defer transformStellarCLIError(&err)
	accountID, err := libkb.ParseStellarAccountID(c.accountID)
	if err != nil {
		return err
	}

	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	destination, err := getInflationDestinationAddrFromString(cli, accountID, c.destination)
	if err != nil {
		return err
	}

	err = cli.SetInflationDestinationLocal(context.Background(), stellar1.SetInflationDestinationLocalArg{
		AccountID:   accountID,
		Destination: destination,
	})
	if err != nil {
		return err
	}
	c.G().UI.GetDumbOutputUI().PrintfStderr("Inflation destination address changed.\n")
	return nil
}

func (c *cmdWalletSetInflation) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
