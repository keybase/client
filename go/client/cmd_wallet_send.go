package client

import (
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/stellarnet"
	"golang.org/x/net/context"
)

type CmdWalletSend struct {
	libkb.Contextified
	Recipient     string
	Amount        string
	Note          string
	LocalCurrency string
	ForceRelay    bool
	FromAccountID stellar1.AccountID
}

func newCmdWalletSend(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.StringFlag{
			Name:  "m, message",
			Usage: "Include a message with the payment.",
		},
		cli.StringFlag{
			Name:  "from",
			Usage: "Specify the source account for the payment.",
		},
	}
	if develUsage {
		flags = append(flags, cli.BoolFlag{
			Name:  "relay",
			Usage: "Force a relay transfer (dev-only)",
		})
	}
	cmd := &CmdWalletSend{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "send",
		Usage:        "Send XLM to a keybase user or stellar address",
		ArgumentHelp: "<recipient> <amount> <local currency> [-m message]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "send", c)
		},
		Flags: flags,
	}
}

func (c *CmdWalletSend) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 3 {
		return errors.New("send expects at most three arguments")
	} else if len(ctx.Args()) < 2 {
		return errors.New("send expects at least two arguments (recipient and amount)")
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
	c.ForceRelay = ctx.Bool("relay")
	c.FromAccountID = stellar1.AccountID(ctx.String("from"))
	return nil
}

func (c *CmdWalletSend) Run() (err error) {
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

	amount := c.Amount
	amountDesc := fmt.Sprintf("%s XLM", amount)

	var displayAmount, displayCurrency string

	if c.LocalCurrency != "" && c.LocalCurrency != "XLM" {
		exchangeRate, err := cli.ExchangeRateLocal(context.Background(), stellar1.OutsideCurrencyCode(c.LocalCurrency))
		if err != nil {
			return fmt.Errorf("Unable to get exchange rate for %q: %s", c.LocalCurrency, err)
		}

		amount, err = stellarnet.ConvertOutsideToXLM(c.Amount, exchangeRate.Rate)
		if err != nil {
			return err
		}

		ui.Printf("Current exchange rate: ~ %s %s / XLM\n", exchangeRate.Rate, c.LocalCurrency)
		amountDesc = fmt.Sprintf("%s XLM (~%s %s)", amount, c.Amount, c.LocalCurrency)
		displayAmount = c.Amount
		displayCurrency = c.LocalCurrency
	}

	_, err = stellarnet.ParseStellarAmount(amount)
	if err != nil {
		return fmt.Errorf("invalid amount of XLM: %q", amount)
	}

	if err := ui.PromptForConfirmation(fmt.Sprintf("Send %s to %s?", ColorString(c.G(), "green", amountDesc), ColorString(c.G(), "yellow", c.Recipient))); err != nil {
		return err
	}

	arg := stellar1.SendCLILocalArg{
		Recipient:       c.Recipient,
		Amount:          amount,
		Asset:           stellar1.AssetNative(),
		Note:            c.Note,
		DisplayAmount:   displayAmount,
		DisplayCurrency: displayCurrency,
		ForceRelay:      c.ForceRelay,
		FromAccountID:   c.FromAccountID,
	}
	res, err := cli.SendCLILocal(context.Background(), arg)
	if err != nil {
		return err
	}

	ui.Printf("Sent!\nKeybase Transaction ID: %v\nStellar Transaction ID: %v\n", res.KbTxID, res.TxID)

	return nil
}

func (c *CmdWalletSend) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
