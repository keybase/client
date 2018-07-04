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
	RecipientName string
	TLFName       string
	Amount        string
	LocalCurrency string
}

func newCmdWalletRequest(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{
		cli.StringFlag{
			Name:  "r, recipient",
			Usage: "Username or user assertion to send the request to.",
		},
	}
	cmd := &CmdWalletRequest{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "request",
		Usage:        "Request XLM from a Keybase user",
		ArgumentHelp: "-r <recipient> <amount> <local currency>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "request", c)
		},
		Flags: flags,
	}
}

func (c *CmdWalletRequest) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) < 1 {
		return errors.New("request expects at least amount argument")
	} else if len(ctx.Args()) > 2 {
		return errors.New("request expects at most two arguments (amount and currency)")
	}
	c.RecipientName = ctx.String("recipient")
	if c.RecipientName == "" {
		return errors.New("recipient argument (-r) is required")
	}
	c.Amount = ctx.Args()[0]
	if len(ctx.Args()) > 1 {
		c.LocalCurrency = strings.ToUpper(ctx.Args()[1])
	}
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

	arg := stellar1.SendRequestCLILocalArg{
		Recipient: c.RecipientName,
		Asset:     stellar1.AssetNative(),
		Amount:    c.Amount,
	}

	err = cli.SendRequestCLILocal(context.Background(), arg)
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
