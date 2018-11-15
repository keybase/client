package client

import (
	"encoding/base64"

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
		Name:  "dump",
		Usage: "Display wallet account keys",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "dump", c)
		},
	}
}

func (c *cmdWalletDump) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *cmdWalletDump) Run() (err error) {
	defer transformStellarCLIError(&err)
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
	bundle, err := cli.WalletDumpLocal(context.Background())
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("Revision: %v\n", bundle.Revision)
	dui.Printf("Prev: %v\n", base64.StdEncoding.EncodeToString(bundle.Prev))
	dui.Printf("OwnHash: %v\n", base64.StdEncoding.EncodeToString(bundle.OwnHash))
	for i, account := range bundle.Accounts {
		if account.IsPrimary {
			dui.Printf("\n[%v] PRIMARY\n", i)
		} else {
			dui.Printf("\n[%v]\n", i)
		}
		if len(account.Name) > 0 {
			dui.Printf("Name: %v\n", account.Name)
		}
		dui.Printf("AccountID: %v\n", account.AccountID)
		accountBundle := bundle.AccountBundles[account.AccountID]
		for j, signer := range accountBundle.Signers {
			dui.Printf("Signers[%v]: %v\n", j, signer.SecureNoLogString())
		}
		dui.Printf("Mode: %v\n", account.Mode)
	}
	return nil
}

func (c *cmdWalletDump) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
