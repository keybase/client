package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type cmdWalletDump struct {
	libkb.Contextified
	address string
}

func newCmdWalletDump(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletDump{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name: "dump",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "dump", c)
		},
	}
}

func (c *cmdWalletDump) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *cmdWalletDump) Run() error {
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}
	dump, err := cli.WalletDump(context.Background())
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("%+v\n", dump)

	return nil
}

func (c *cmdWalletDump) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
