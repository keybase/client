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
	for _, asset := range assets {
		dui.Printf(buildOutputStringForAsset(asset) + "\n")
	}
	return nil
}

func buildOutputStringForAsset(asset stellar1.Asset) string {
	var out string
	out = fmt.Sprintf("Asset Code: %12s", asset.Code)
	out = fmt.Sprintf("%s | Issuer ID: %s", out, asset.Issuer)
	switch {
	case asset.VerifiedDomain != "":
		out = fmt.Sprintf("%s | Verified Domain: %s", out, asset.VerifiedDomain)
	case asset.IssuerName != "":
		out = fmt.Sprintf("%s | Issuer Name: %s", out, asset.IssuerName)
	case asset.InfoUrl != "":
		out = fmt.Sprintf("%s | Info URL (not verified): %s", out, asset.InfoUrl)
	}
	return out
}
