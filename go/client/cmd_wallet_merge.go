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
	FromSecretKey *stellar1.SecretKey
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
		Usage:        "merge all assets into an account ID from any secret key or an account ID in your wallet",
		ArgumentHelp: "<from account-id/seed> [--to account-id/user]",
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
	c.To = ctx.String("to")

	// try to parse as a secret key
	fromSecretKey, fromAccountID, _, err := libkb.ParseStellarSecretKey(ctx.Args()[0])
	if err == nil {
		c.FromSecretKey = &fromSecretKey
		c.FromAccountID = fromAccountID
		return nil
	}
	// if not, fallback and assume it's an account id
	fromAccountID, err = libkb.ParseStellarAccountID(ctx.Args()[0])
	if err != nil {
		return err
	}
	c.FromAccountID = fromAccountID
	c.FromSecretKey = nil
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

	confirmationTo := c.To
	if confirmationTo == "" {
		confirmationTo = "your primary account"
	}

	confirmationMsg := fmt.Sprintf("Merge all of the assets from %s into %s?",
		ColorString(c.G(), "yellow", c.FromAccountID.String()), ColorString(c.G(), "green", confirmationTo))
	if err := ui.PromptForConfirmation(confirmationMsg); err != nil {
		return err
	}

	arg := stellar1.AccountMergeCLILocalArg{
		FromSecretKey: c.FromSecretKey,
		FromAccountID: c.FromAccountID,
		To:            c.To,
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
