package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

type cmdWalletSetMobileOnly struct {
	libkb.Contextified
	accountID string
}

func newCmdWalletSetMobileOnly(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletSetMobileOnly{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name: "set-mobile-only",
		// Hide this command from `keybase wallet -h`, `keybase help wallet`:
		// Usage: "Set an account to mobile-only mode",
		Description: "Set an account to mobile-only mode",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "set-mobile-only", c)
		},
	}
}

func (c *cmdWalletSetMobileOnly) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 1 {
		return errors.New("one Stellar address required, multiple found")
	} else if len(ctx.Args()) == 1 {
		c.accountID = ctx.Args()[0]
	}

	return nil
}

func (c *cmdWalletSetMobileOnly) Run() (err error) {
	defer transformStellarCLIError(&err)
	accountID, err := libkb.ParseStellarAccountID(c.accountID)
	if err != nil {
		return err
	}

	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	err = cli.SetAccountMobileOnlyLocal(context.Background(), stellar1.SetAccountMobileOnlyLocalArg{AccountID: accountID})
	if err != nil {
		return err
	}

	dui := c.G().UI.GetDumbOutputUI()
	dui.Printf("The secret keys for account %s are now only accessible by mobile devices.\n", accountID)

	return nil
}

func (c *cmdWalletSetMobileOnly) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
