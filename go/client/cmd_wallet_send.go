package client

import (
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

type cmdWalletSend struct {
	libkb.Contextified
	recipient     string
	amount        string
	note          string
	localCurrency string
}

func newCmdWalletSend(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.StringFlag{
			Name:  "m, message",
			Usage: "Include a message with the payment.",
		},
	}
	cmd := &cmdWalletSend{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "send",
		ArgumentHelp: "<recipient> <amount> <local currency> [-m message]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "send", c)
		},
		Flags: flags,
	}
}

func (c *cmdWalletSend) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 3 {
		return errors.New("send expects at most three arguments")
	} else if len(ctx.Args()) < 2 {
		return errors.New("send expects at least two arguments (recipient and amount)")
	}

	c.recipient = ctx.Args()[0]
	c.amount = ctx.Args()[1]
	if len(ctx.Args()) == 3 {
		c.localCurrency = strings.ToUpper(ctx.Args()[2])
		if len(c.localCurrency) != 3 {
			return errors.New("Invalid currency code")
		}
	}
	c.note = ctx.String("message")
	return nil
}

func (c *cmdWalletSend) Run() error {
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()

	amount := c.amount
	amountDesc := fmt.Sprintf("%s XLM", amount)

	if c.localCurrency != "" && c.localCurrency != "XLM" {
		exchangeRate, err := cli.ExchangeRateLocal(context.Background(), stellar1.LocalCurrencyCode(c.localCurrency))
		if err != nil {
			return fmt.Errorf("Unable to get exchange rate for %q: %s", c.localCurrency, err)
		}

		amount, err = exchangeRate.ConvertLocalToXLM(c.amount, 4)
		if err != nil {
			return err
		}

		ui.Printf("Current exchange rate for XLM%s is: ~%s\n", c.localCurrency, exchangeRate.Format('f', 4))
		amountDesc = fmt.Sprintf("%s XLM (~%s %s)", amount, c.amount, c.localCurrency)
	}

	if err := ui.PromptForConfirmation(fmt.Sprintf("Send %s to %s?", ColorString(c.G(), "green", amountDesc), ColorString(c.G(), "yellow", c.recipient))); err != nil {
		return err
	}

	arg := stellar1.SendLocalArg{
		Recipient: c.recipient,
		Amount:    amount,
		Asset:     stellar1.Asset{Type: "native"},
		Note:      c.note,
	}
	res, err := cli.SendLocal(context.Background(), arg)
	if err != nil {
		return err
	}

	ui.Printf("Sent: %+v\n", res)

	return nil
}

func (c *cmdWalletSend) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
