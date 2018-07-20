package client

import (
	"errors"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdWalletRequest struct {
	libkb.Contextified
	Recipient     string
	TLFName       string
	Amount        string
	LocalCurrency string
	Note          string
}

func newCmdWalletRequest(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.StringFlag{
			Name:  "m, message",
			Usage: "Include a message with the request.",
		},
	}
	cmd := &CmdWalletRequest{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "request",
		Usage:        "Request XLM from a Keybase user",
		ArgumentHelp: "<recipient> <amount> <local currency> [-m message]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "request", c)
		},
		Flags: flags,
	}
}

func (c *CmdWalletRequest) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 3 {
		return errors.New("request expects at most three arguments")
	} else if len(ctx.Args()) < 2 {
		return errors.New("request expects at least two arguments (recipient and amount)")
	}

	c.Recipient = ctx.Args()[0]
	// TODO ensure amount is numeric and does not contain escape characters
	c.Amount = ctx.Args()[1]
	if len(ctx.Args()) == 3 {
		c.LocalCurrency = strings.ToUpper(ctx.Args()[2])
		if len(c.LocalCurrency) != 3 {
			return errors.New("Invalid currency code")
		}
	}
	c.Note = ctx.String("message")
	return nil
}

func (c *CmdWalletRequest) Run() error {
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

	arg := stellar1.MakeRequestCLILocalArg{
		Recipient: c.Recipient,
		Note:      c.Note,
		Amount:    c.Amount,
	}

	if c.LocalCurrency != "" && c.LocalCurrency != "XLM" {
		currency := stellar1.OutsideCurrencyCode(c.LocalCurrency)
		arg.Currency = &currency
	} else {
		xlm := stellar1.AssetNative()
		arg.Asset = &xlm
	}

	_, err = cli.MakeRequestCLILocal(context.Background(), arg)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdWalletRequest) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
