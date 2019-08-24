package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

type CmdWalletSendPathPayment struct {
	libkb.Contextified
	Recipient         string
	SourceAsset       stellar1.Asset
	DestinationAsset  stellar1.Asset
	DestinationAmount string
	Note              string
	FromAccountID     stellar1.AccountID
}

func newCmdWalletSendPathPayment(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.StringFlag{
			Name:  "source-asset",
			Usage: "Asset code/issuer for source asset.",
		},
		cli.StringFlag{
			Name:  "destination-asset",
			Usage: "Asset code/issuer for destination asset.",
		},
		cli.StringFlag{
			Name:  "m, message",
			Usage: "Include a message with the payment.",
		},
		cli.StringFlag{
			Name:  "from",
			Usage: "Specify the source account for the payment.",
		},
	}
	cmd := &CmdWalletSendPathPayment{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "send-path-payment",
		Usage:        "Send a path payment to a keybase user or stellar address",
		ArgumentHelp: "<recipient> <destination amount>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "send-path-payment", c)
		},
		Flags:    flags,
		Examples: "keybase wallet send-path-payment alice 10.3923 --source-asset native --destination-asset USD/GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX -m 'here's some anchorusd!'",
	}
}

func (c *CmdWalletSendPathPayment) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 2 {
		return errors.New("send-path-payment requires recipient and amount")
	}
	c.Recipient = ctx.Args()[0]
	c.DestinationAmount = ctx.Args()[1]
	c.Note = ctx.String("message")
	c.FromAccountID = stellar1.AccountID(ctx.String("from"))
	var err error
	c.SourceAsset, err = parseAssetString(ctx.String("source-asset"))
	if err != nil {
		return err
	}
	c.DestinationAsset, err = parseAssetString(ctx.String("destination-asset"))
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdWalletSendPathPayment) Run() (err error) {
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

	ui.Printf(ColorString(c.G(), "yellow", "Searching for payment path for %s to %s...\n", c.SourceAsset, c.DestinationAsset))
	findArg := stellar1.FindPaymentPathLocalArg{
		From:             c.FromAccountID,
		To:               c.Recipient,
		SourceAsset:      c.SourceAsset,
		DestinationAsset: c.DestinationAsset,
		Amount:           c.DestinationAmount,
	}
	path, err := cli.FindPaymentPathLocal(context.Background(), findArg)
	if err != nil {
		return err
	}

	// TODO: when SourceDisplay, SourceMaxDisplay, DestinationDisplay filled in, use those
	ui.Printf("Sending approximately %s of %s (at most %s)\n", path.FullPath.SourceAmount, path.FullPath.SourceAsset, path.FullPath.SourceAmountMax)
	ui.Printf("User %s will receive %s of %s\n\n", c.Recipient, path.FullPath.DestinationAmount, path.FullPath.DestinationAsset)

	if err := ui.PromptForConfirmation("Proceed?"); err != nil {
		return err
	}

	ui.Printf(ColorString(c.G(), "yellow", "Submitting transaction to the Stellar network..."))
	sendArg := stellar1.SendPathCLILocalArg{
		Source:    c.FromAccountID,
		Recipient: c.Recipient,
		Path:      path.FullPath,
		Note:      c.Note,
	}
	res, err := cli.SendPathCLILocal(context.Background(), sendArg)
	if err != nil {
		return err
	}

	ui.Printf("Sent!\nKeybase Transaction ID: %v\nStellar Transaction ID: %v\n", res.KbTxID, res.TxID)
	return nil
}

func (c *CmdWalletSendPathPayment) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
