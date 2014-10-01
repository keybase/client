
package libkbgo

import (
	"github.com/codegangsta/cli"
)

type PosixCmdLine struct {
	app *cli.App
	ctx *cli.Context
}

func (p PosixCmdLine) GetHome() string { return p.ctx.String("home"); }

func (p *PosixCmdLine) Parse(args []string) error {
	app := cli.NewApp()
	app.Name = "keybase"
	app.Usage = "control keybase either with one-off commands, or enable a background daemon"
	app.Flags = []cli.Flag {
		cli.StringFlag {
			Name : "home, H",
			Usage : "specify an (alternate) home directory",
		},
	}
	app.Action = func (c *cli.Context) {
		p.ctx = c
	}
	p.app = app
	return app.Run(args)
}
