package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

type cmdWalletTrustlineCommon struct {
	accountID   stellar1.AccountID
	assetCode   stellar1.AssetCode
	assetIssuer stellar1.AccountID
}

func (c *cmdWalletTrustlineCommon) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}

func parseTrustlineCommon(ctx *cli.Context, c *cmdWalletTrustlineCommon) error {
	var err error
	accountID := ctx.String("account")
	if accountID != "" {
		// Parse account if provided, stellar RPCs use primary accounts by
		// default if accountID is empty.
		c.accountID, err = libkb.ParseStellarAccountID(accountID)
		if err != nil {
			return fmt.Errorf("unable to parse `account` argument: %s", err.Error())
		}
	}
	assetCode := ctx.String("code")
	if assetCode == "" {
		return fmt.Errorf("code argument is required")
	}
	c.assetCode, err = libkb.ParseStellarAssetCode(assetCode)
	if err != nil {
		return fmt.Errorf("unable to parse `code` argument: %s", err.Error())
	}
	assetIssuer := ctx.String("issuer")
	if assetIssuer == "" {
		return fmt.Errorf("issuer argument is required")
	}
	c.assetIssuer, err = libkb.ParseStellarAccountID(assetIssuer)
	if err != nil {
		return fmt.Errorf("unable to parse `issuer` argument: %s", err.Error())
	}
	return nil
}

func getTrustlineCommonFlags() []cli.Flag {
	return []cli.Flag{
		cli.StringFlag{
			Name:  "a,account",
			Usage: "Account to add the trustline to",
		},
		cli.StringFlag{
			Name:  "c, code",
			Usage: "Asset code",
		},
		cli.StringFlag{
			Name:  "i, issuer",
			Usage: "Asset issuer",
		},
	}
}

type cmdWalletAddTrustline struct {
	libkb.Contextified
	cmdWalletTrustlineCommon
	limit string
}

func newCmdWalletAddTrustline(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletAddTrustline{
		Contextified: libkb.NewContextified(g),
	}
	flags := getTrustlineCommonFlags()
	flags = append(flags, cli.StringFlag{
		Name:  "limit",
		Usage: "Balance limit for the trustline (default: max)",
	})
	return cli.Command{
		Name:  "add-trustline",
		Usage: "Add trustline to an account",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "add-trustline", c)
		},
		Flags: flags,
	}
}

func (c *cmdWalletAddTrustline) ParseArgv(ctx *cli.Context) error {
	if err := parseTrustlineCommon(ctx, &c.cmdWalletTrustlineCommon); err != nil {
		return err
	}
	c.limit = ctx.String("limit")
	return nil
}

func (c *cmdWalletAddTrustline) Run() (err error) {
	defer transformStellarCLIError(&err)

	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	arg := stellar1.AddTrustlineLocalArg{
		AccountID: c.accountID,
		Trustline: stellar1.Trustline{
			AssetCode: c.assetCode,
			Issuer:    c.assetIssuer,
		},
		Limit: c.limit,
	}
	err = cli.AddTrustlineLocal(context.Background(), arg)
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	ui.Printf("Trustline added\n")
	return nil
}

// =====================================================

type cmdWalletDeleteTrustline struct {
	libkb.Contextified
	cmdWalletTrustlineCommon
}

func newCmdWalletDeleteTrustline(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletDeleteTrustline{
		Contextified: libkb.NewContextified(g),
	}
	flags := getTrustlineCommonFlags()
	return cli.Command{
		Name:  "delete-trustline",
		Usage: "Delete trustline from an account",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "delete-trustline", c)
		},
		Flags: flags,
	}
}

func (c *cmdWalletDeleteTrustline) ParseArgv(ctx *cli.Context) error {
	if err := parseTrustlineCommon(ctx, &c.cmdWalletTrustlineCommon); err != nil {
		return err
	}
	return nil
}

func (c *cmdWalletDeleteTrustline) Run() (err error) {
	defer transformStellarCLIError(&err)

	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	arg := stellar1.DeleteTrustlineLocalArg{
		AccountID: c.accountID,
		Trustline: stellar1.Trustline{
			AssetCode: c.assetCode,
			Issuer:    c.assetIssuer,
		},
	}
	err = cli.DeleteTrustlineLocal(context.Background(), arg)
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	ui.Printf("Trustline deleted\n")
	return nil
}

// =====================================================

type cmdWalletChangeTrustlineLimit struct {
	libkb.Contextified
	cmdWalletTrustlineCommon
	limit string
}

func newCmdWalletChangeTrustlineLimit(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletChangeTrustlineLimit{
		Contextified: libkb.NewContextified(g),
	}
	flags := getTrustlineCommonFlags()
	flags = append(flags, cli.StringFlag{
		Name:  "l, limit",
		Usage: "Balance limit for the trustline",
	})
	return cli.Command{
		Name:  "change-trustline-limit",
		Usage: "Change limit of a trustline in an account",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "change-trustline-limit", c)
		},
		Flags: flags,
	}
}

func (c *cmdWalletChangeTrustlineLimit) ParseArgv(ctx *cli.Context) error {
	if err := parseTrustlineCommon(ctx, &c.cmdWalletTrustlineCommon); err != nil {
		return err
	}
	c.limit = ctx.String("limit")
	if c.limit == "" {
		return fmt.Errorf("`limit` argument is required")
	}
	return nil
}

func (c *cmdWalletChangeTrustlineLimit) Run() (err error) {
	defer transformStellarCLIError(&err)

	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	arg := stellar1.ChangeTrustlineLimitLocalArg{
		AccountID: c.accountID,
		Trustline: stellar1.Trustline{
			AssetCode: c.assetCode,
			Issuer:    c.assetIssuer,
		},
		Limit: c.limit,
	}
	err = cli.ChangeTrustlineLimitLocal(context.Background(), arg)
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	ui.Printf("Trustline limit changed\n")
	return nil
}
