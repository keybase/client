package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type cmdWotAccept struct {
	username string
	libkb.Contextified
}

func newCmdWotAccept(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{}
	cmd := &cmdWotAccept{
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

func (c *cmdWotAccept) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("accept requires a username")
	}
	c.username = ctx.Args()[0]
	return nil
}

func (c *cmdWotAccept) Run() error {
	arg := keybase1.WotReactCLIArg{
		Username: c.username,
		Reaction: keybase1.WotReactionType_ACCEPT,
	}

	cli, err := GetWebOfTrustClient(c.G())
	if err != nil {
		return err
	}
	return cli.WotReactCLI(context.Background(), arg)
}

func (c *cmdWotAccept) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

/////////////////////////////////////////

type cmdWotReject struct {
	username string
	libkb.Contextified
}

func newCmdWotReject(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := []cli.Flag{}
	cmd := &cmdWotReject{
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

func (c *cmdWotReject) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("reject requires a username")
	}
	c.username = ctx.Args()[0]
	return nil
}

func (c *cmdWotReject) Run() error {
	arg := keybase1.WotReactCLIArg{
		Username: c.username,
		Reaction: keybase1.WotReactionType_REJECT,
	}

	cli, err := GetWebOfTrustClient(c.G())
	if err != nil {
		return err
	}
	return cli.WotReactCLI(context.Background(), arg)
}

func (c *cmdWotReject) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
