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

type cmdWalletSend struct {
	libkb.Contextified
	recipient string
	amount    string
	note      string
}

func newCmdWalletSend(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletSend{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "send",
		ArgumentHelp: "<recipient> <amount>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "send", c)
		},
	}
}

func (c *cmdWalletSend) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 2 {
		return errors.New("send expects exactly two arguments")
	}

	c.recipient = ctx.Args()[0]
	c.amount = ctx.Args()[1]
	return nil
}

func (c *cmdWalletSend) Run() error {
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	if err := ui.PromptForConfirmation(fmt.Sprintf("Send %s XLM to %s?", ColorString(c.G(), "green", c.amount), ColorString(c.G(), "yellow", c.recipient))); err != nil {
		return err
	}

	arg := stellar1.SendLocalArg{
		Recipient: c.recipient,
		Amount:    c.amount,
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
