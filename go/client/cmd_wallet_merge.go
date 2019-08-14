package client

import (
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdWalletMerge struct {
	libkb.Contextified
	FromAccountID stellar1.AccountID
	To            string
}

func newCmdWalletMerge(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.StringFlag{
			Name:  "to",
			Usage: "Specify into which account or user the merge will happen (defaults to your primary account).",
		},
	}
	cmd := &CmdWalletMerge{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "merge",
		Usage:        "Delete an account by merging XLM and any other assets to another stellar address",
		ArgumentHelp: "<from-account-id> [--to account-id/user]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "merge", c)
		},
		Flags: flags,
	}
}

func (c *CmdWalletMerge) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("expecting one argument for the account to be merged away")
	}
	from, err := libkb.ParseStellarAccountID(ctx.Args()[0])
	if err != nil {
		return err
	}
	c.FromAccountID = from
	c.To = ctx.String("to")
	return nil
}

func (c *CmdWalletMerge) Run() (err error) {
	defer transformStellarCLIError(&err)
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewIdentifyUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	ui := c.G().UI.GetTerminalUI()

	primary, err := getPrimaryAccount(cli)
	if err != nil {
		return err
	}
	if c.FromAccountID == primary.AccountID {
		// this works on the stellar level, but the primary account won't be removed from the bundle,
		// so that step will error and the account will stick around with no funds. we could easily
		// bypass this check and catch that specific error if there's ever a usecase for this.
		return fmt.Errorf("cannot merge away your primary account")
	}
	if c.To == "" {
		// if unspecified, default the target account to the user's primary
		c.To = primary.AccountID.String()
		ui.Printf("defaulting target to your primary account (%s: %v)\n", primary.Name, ColorString(c.G(), "green", c.To))
	}

	confirmationMsg := fmt.Sprintf("Merge all of the assets from %s into %s?", ColorString(c.G(), "yellow", c.FromAccountID.String()), ColorString(c.G(), "green", c.To))
	if err := ui.PromptForConfirmation(confirmationMsg); err != nil {
		return err
	}

	arg := stellar1.AccountMergeCLILocalArg{
		From: c.FromAccountID,
		To:   c.To,
	}
	txID, err := cli.AccountMergeCLILocal(context.Background(), arg)
	if err != nil {
		return err
	}

	ui.Printf("Sent!\nStellar Transaction ID: %v\n", txID)

	return nil
}

func (c *CmdWalletMerge) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

func getPrimaryAccount(cli stellar1.LocalClient) (acct stellar1.WalletAccountLocal, err error) {
	accounts, err := cli.GetWalletAccountsLocal(context.Background(), 0)
	if err != nil {
		return acct, err
	}
	for _, account := range accounts {
		if account.IsDefault {
			return account, nil
		}
	}
	return acct, fmt.Errorf("couldn't find your primary account")
}
