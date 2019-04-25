package client

import (
	"errors"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
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
	cmd := &CmdWalletSend{
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
	c.SourceAsset, err = c.parseAssetFlag(ctx.String("source-asset"))
	if err != nil {
		return err
	}
	c.DestinationAsset, err = c.parseAssetFlag(ctx.String("destination-asset"))
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdWalletSendPathPayment) Run() (err error) {
	defer transformStellarCLIError(&err)
	return nil
}

func (c *CmdWalletSendPathPayment) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

func (c *CmdWalletSendPathPayment) parseAssetFlag(f string) (stellar1.Asset, error) {
	if f == "native" {
		return stellar1.AssetNative(), nil
	}
	pieces := strings.Split(f, "/")
	if len(pieces) != 2 {
		return stellar1.Asset{}, errors.New("invalid asset string")
	}
	t, err := stellar1.CreateNonNativeAssetType(pieces[0])
	if err != nil {
		return stellar1.Asset{}, err
	}
	return stellar1.Asset{
		Type:   t,
		Code:   pieces[0],
		Issuer: pieces[1],
	}, nil
}
