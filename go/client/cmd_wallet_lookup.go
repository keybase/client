package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdWalletLookup struct {
	libkb.Contextified
	Name string
}

func newCmdWalletLookup(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdWalletLookup{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "lookup",
		Usage:        "Look up Stellar account ID based on Keybase name or Stellar federation address.",
		ArgumentHelp: "<name>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "lookup", c)
		},
	}
}

func (c *CmdWalletLookup) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("lookup requires one argument (name)")
	}
	c.Name = ctx.Args()[0]
	return nil
}

func (c *CmdWalletLookup) Run() error {
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

	dui := c.G().UI.GetDumbOutputUI()
	res, err := cli.LookupCLILocal(context.Background(), c.Name)
	if err != nil {
		return err
	}

	dui.Printf("%q: %s\n", c.Name, res.AccountID)
	if res.Username != nil {
		dui.Printf("Belonging to https://keybase.io/%s\n", *res.Username)
	}
	return nil
}

func (c *CmdWalletLookup) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
