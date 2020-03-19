package client

import (
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type cmdWotList struct {
	libkb.Contextified
	vouchee *string
	voucher *string
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
			cli.StringFlag{
				Name:  "voucher",
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
		c.vouchee = &username
	}
	voucher := ctx.String("voucher")
	if len(voucher) > 0 {
		c.voucher = &voucher
	}
	return nil
}

func (c *cmdWotList) Run() error {
	ctx := context.Background()
	me := c.G().Env.GetUsername().String()
	arg := keybase1.WotListCLIArg{
		Vouchee: c.vouchee,
		Voucher: c.voucher,
	}

	cli, err := GetWebOfTrustClient(c.G())
	if err != nil {
		return err
	}
	res, err := cli.WotListCLI(ctx, arg)
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
	var targetVouchee, targetVoucher *string
	if c.vouchee != nil {
		targetVouchee = c.vouchee
	} else {
		if c.voucher == nil || (c.voucher != nil && *c.voucher != me) {
			targetVouchee = &me
		}
	}
	if c.voucher != nil {
		targetVoucher = c.voucher
	}

	if targetVouchee != nil {
		wotTitle += fmt.Sprintf(" for %s", *targetVouchee)
	}
	if targetVoucher != nil {
		wotTitle += fmt.Sprintf(" by %s", *targetVoucher)
	}
	line(wotTitle)
	line("-------------------------------")
	if len(res) == 0 {
		line("no attestations to show")
		return nil
	}
	for _, vouch := range res {
		vouchTexts := strings.Join(vouch.VouchTexts, ", ")
		voucher, err := c.G().GetUPAKLoader().LookupUsername(ctx, vouch.Voucher.Uid)
		if err != nil {
			return fmt.Errorf("error looking up username for vouch: %s", err.Error())
		}
		line("Voucher: %s", voucher)
		line("Attestation: \"%s\"", vouchTexts)
		line("Status: %s", vouch.Status)
		if vouch.Status == keybase1.WotStatusType_PROPOSED {
			if targetVouchee != nil && *targetVouchee == me {
				line("    `keybase wot accept %s` to accept this into your web-of-trust", voucher)
			} else if targetVoucher != nil && *targetVoucher == me {
				line("    `keybase wot revoke %s` to revoke your proposed vouch (coming soon)", voucher) // TODO
			}
		}
		if vouch.Confidence != nil {
			line("Additional Details: %+v", *vouch.Confidence)
		}
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
