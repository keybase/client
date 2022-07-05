package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type CmdWotAccept struct {
	Voucher string
	libkb.Contextified
}

func newCmdWotAccept(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{}
	cmd := &CmdWotAccept{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:        "accept",
		Usage:       "Accept a claim made by another user",
		Description: "Accept a claim made by another user",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "accept", c)
		},
		Flags: flags,
	}
}

func (c *CmdWotAccept) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("accept requires a username")
	}
	c.Voucher = ctx.Args()[0]
	return nil
}

func (c *CmdWotAccept) Run() error {
	arg := keybase1.WotReactArg{
		Voucher:  c.Voucher,
		Reaction: keybase1.WotReactionType_ACCEPT,
	}

	cli, err := GetWebOfTrustClient(c.G())
	if err != nil {
		return err
	}
	return cli.WotReact(context.Background(), arg)
}

func (c *CmdWotAccept) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

/////////////////////////////////////////

type CmdWotReject struct {
	Voucher string
	libkb.Contextified
}

func newCmdWotReject(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{}
	cmd := &CmdWotReject{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:        "reject",
		Usage:       "Reject a claim made by another user",
		Description: "Reject a claim made by another user",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "reject", c)
		},
		Flags:    flags,
		Unlisted: true,
	}
}

func (c *CmdWotReject) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("reject requires a username")
	}
	c.Voucher = ctx.Args()[0]
	return nil
}

func (c *CmdWotReject) Run() error {
	arg := keybase1.WotReactArg{
		Voucher:  c.Voucher,
		Reaction: keybase1.WotReactionType_REJECT,
	}

	cli, err := GetWebOfTrustClient(c.G())
	if err != nil {
		return err
	}
	return cli.WotReact(context.Background(), arg)
}

func (c *CmdWotReject) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
