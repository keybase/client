package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

func (c *cmdWalletPopularAssets) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}

type cmdWalletPopularAssets struct {
	libkb.Contextified
}

func newCmdWalletPopularAssets(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletPopularAssets{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:  "popular-assets",
		Usage: "List popular assets",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "popular-assets", c)
		},
	}
}

func (c *cmdWalletPopularAssets) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("listing popular assets expects no args")
	}
	return nil
}

func (c *cmdWalletPopularAssets) Run() (err error) {
	defer transformStellarCLIError(&err)

	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	assetRes, err := cli.ListPopularAssetsLocal(context.Background(), 0)
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("popular assets from a total of %d:\n", assetRes.TotalCount)
	for _, asset := range assetRes.Assets {
		dui.Printf(buildOutputStringForAsset(asset) + "\n")
	}
	return nil
}
