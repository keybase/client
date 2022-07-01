package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

type cmdWalletGetInflation struct {
	libkb.Contextified
	accountID string
}

func newCmdWalletGetInflation(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletGetInflation{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "get-inflation",
		Usage:        "Get inflation destination address of an account",
		ArgumentHelp: "<account id>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "get-inflation", c)
		},
	}
}

func (c *cmdWalletGetInflation) ParseArgv(ctx *cli.Context) error {
	args := ctx.Args()
	if len(args) != 1 {
		return fmt.Errorf("Expecting one argument")
	}
	c.accountID = args[0]
	return nil
}

func (c *cmdWalletGetInflation) Run() (err error) {
	defer transformStellarCLIError(&err)
	accountID, err := libkb.ParseStellarAccountID(c.accountID)
	if err != nil {
		return err
	}

	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	dest, err := cli.GetInflationDestinationLocal(context.Background(), stellar1.GetInflationDestinationLocalArg{
		AccountID: accountID,
	})
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	var formatted string
	if dest.Destination != nil {
		formatted = dest.Destination.String()
	} else {
		formatted = "(not set)"
	}
	var maybeComment string
	if dest.Self {
		maybeComment = " (self)"
	} else if dest.KnownDestination != nil {
		maybeComment = fmt.Sprintf(" (%s, %s)", dest.KnownDestination.Name, dest.KnownDestination.Url)
	}
	dui.Printf("Checking inflation destination for %s\n", accountID)
	dui.Printf("Inflation destination: %s%s\n", formatted, maybeComment)
	return nil
}

func (c *cmdWalletGetInflation) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}
