package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

func (c *cmdWalletAssetSearch) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}

type cmdWalletAssetSearch struct {
	libkb.Contextified
	searchString string
}

func newCmdWalletAssetSearch(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletAssetSearch{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:  "asset-search",
		Usage: "Search for popular assets",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "asset-search", c)
		},
	}
}

func (c *cmdWalletAssetSearch) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("asset search expects one arg, the search string")
	}
	c.searchString = ctx.Args()[0]
	return nil
}

func (c *cmdWalletAssetSearch) Run() (err error) {
	defer transformStellarCLIError(&err)

	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	arg := stellar1.FuzzyAssetSearchLocalArg{
		SearchString: c.searchString,
	}
	assets, err := cli.FuzzyAssetSearchLocal(context.Background(), arg)
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	if len(assets) == 0 {
		dui.Printf("no matching assets.\n")
		return nil
	}
	dui.Printf("matching assets:\n")
	for i, asset := range assets {
		dui.Printf("%d: code: %s, issuer: %s\n", i, asset.Code, asset.IssuerName)
	}
	return nil
}
