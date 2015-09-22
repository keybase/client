package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdDbNuke struct {
	force bool
}

func (c *CmdDbNuke) ParseArgv(ctx *cli.Context) error {
	c.force = ctx.Bool("force")
	return nil
}

func (c *CmdDbNuke) Run() error {
	var err error
	if !c.force {
		err = GlobUI.PromptForConfirmation("Really blast away your local database?")
	}
	if err == nil {
		cli, err := GetCtlClient()
		if err != nil {
			return err
		}
		protocols := []rpc2.Protocol{
		}
		if err = RegisterProtocols(protocols); err != nil {
			return err
		}
		return cli.DbNuke(0)
	}
	return err
}

func NewCmdDbNuke(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "nuke",
		Usage: "Delete the local database",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdDbNuke{}, "nuke", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "force, f",
				Usage: "Don't prompt.",
			},
		},
	}
}

func NewCmdDb(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "db",
		Usage: "Manage the local database",
		Subcommands: []cli.Command{
			NewCmdDbNuke(cl),
		},
	}
}

func (c *CmdDbNuke) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
