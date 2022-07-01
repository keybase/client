package client

import (
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type cmdWotList struct {
	libkb.Contextified
	vouchee string
	voucher string
	byMe    bool
}

func newCmdWotList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWotList{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:        "list",
		Usage:       "List a user's web-of-trust attestations",
		Description: "List a user's web-of-trust attestations",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "list", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "by-me",
				Usage: "Only get vouches written by me",
			},
		},
	}
}

func (c *cmdWotList) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 1 {
		return errors.New("too many arguments")
	}
	if len(ctx.Args()) == 1 {
		username := ctx.Args()[0]
		c.vouchee = username
	}
	c.byMe = ctx.Bool("by-me")
	return nil
}

func (c *cmdWotList) Run() error {
	ctx := context.Background()
	me := c.G().Env.GetUsername().String()
	if c.byMe {
		c.voucher = me
	}

	if len(c.voucher) > 0 && len(c.vouchee) > 0 {
		// don't allow specifying both
		return errors.New("can't specify both a vouchee and --byMe; please remove one")
	}

	arg := keybase1.WotFetchVouchesArg{
		Vouchee: c.vouchee,
		Voucher: c.voucher,
	}

	cli, err := GetWebOfTrustClient(c.G())
	if err != nil {
		return err
	}
	res, err := cli.WotFetchVouches(ctx, arg)
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	line := func(format string, args ...interface{}) {
		dui.Printf(format+"\n", args...)
	}

	// for displaying appropriate text, explicate vouchee and voucher with
	// targetVouchee and targetVoucher
	wotTitle := "Web-Of-Trust"
	var targetVouchee, targetVoucher string
	if len(c.vouchee) == 0 && len(c.voucher) == 0 {
		targetVouchee = me
	} else if len(c.vouchee) > 0 {
		targetVouchee = c.vouchee
	} else if len(c.voucher) > 0 {
		targetVoucher = c.voucher
	}

	if len(targetVouchee) > 0 {
		wotTitle += fmt.Sprintf(" for %s", targetVouchee)
	}
	if len(targetVoucher) > 0 {
		wotTitle += fmt.Sprintf(" by %s", targetVoucher)
	}
	line(wotTitle)
	line("-------------------------------")
	if len(res) == 0 {
		line("no attestations to show")
		return nil
	}
	for _, vouch := range res {
		line("Vouchee: %s", vouch.VoucheeUsername)
		line("Voucher: %s", vouch.VoucherUsername)
		line("Attestation: \"%s\"", vouch.VouchText)
		line("Status: %s", vouch.Status)
		if vouch.Status == keybase1.WotStatusType_PROPOSED {
			if len(targetVouchee) > 0 && targetVouchee == me {
				line("    `keybase wot accept %s` to accept this into your web-of-trust", vouch.VoucherUsername)
			} else if len(targetVoucher) > 0 && targetVoucher == me {
				line("    `keybase wot revoke %s` to revoke your proposed vouch (coming soon)", vouch.VoucheeUsername) // TODO
			}
		}
		line("Additional Details: %+v", vouch.Confidence)
		line("-------------------------------")
	}
	return nil
}

func (c *cmdWotList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
