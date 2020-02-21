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
	username *string
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
		Flags: []cli.Flag{},
	}
}

func (c *cmdWotList) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 1 {
		return errors.New("too many arguments")
	}
	if len(ctx.Args()) == 1 {
		username := ctx.Args()[0]
		c.username = &username
	}
	return nil
}

func (c *cmdWotList) Run() error {
	ctx := context.Background()
	arg := keybase1.WotListCLIArg{
		Username: c.username,
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
	line("Web-Of-Trust")
	if len(res) == 0 {
		line("no attestations to show")
		return nil
	}
	line("  STATUS   | VOUCHER : ATTESTATION")
	for _, vouch := range res {
		vouchTexts := strings.Join(vouch.VouchTexts, ", ")
		voucher, err := c.G().GetUPAKLoader().LookupUsername(ctx, vouch.Voucher.Uid)
		if err != nil {
			return fmt.Errorf("error looking up username for vouch: %s", err.Error())
		}
		line("%10s | %s: \"%s\"", vouch.Status, voucher, vouchTexts)
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
