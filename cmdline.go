
package libkbgo

import (
	"github.com/codegangsta/cli"
)

type PosixCommandLine struct {
	app *cli.App
	ctx *cli.Context
}

func (p PosixCommandLine) GetHome() string { return p.ctx.String("home"); }
func (p PosixCommandLine) GetServerUri() string { return p.ctx.String("server"); }
func (p PosixCommandLine) GetConfigFilename() string { return p.ctx.String("config"); }
func (p PosixCommandLine) GetSessionFilename() string { return p.ctx.String("session"); }
func (p PosixCommandLine) GetDbFilename() string { return p.ctx.String("db"); }
func (p PosixCommandLine) GetDebug() (bool, bool) { return p.GetBool("debug") }
func (p PosixCommandLine) GetApiUriPathPrefix() string { return p.ctx.String("api-uri-path-prefix"); }
func (p PosixCommandLine) GetUsername() string { return p.ctx.String("username") }
func (p PosixCommandLine) GetProxy() string { return p.ctx.String("proxy") }


func (p PosixCommandLine) GetBool(s string) (bool, bool) {
	v := p.ctx.Bool(s);
	return v, v
}

func (p *PosixCommandLine) Parse(args []string) (bool, error) {
	app := cli.NewApp()
	app.Name = "keybase"
	app.Usage = "control keybase either with one-off commands, or enable a background daemon"
	app.Flags = []cli.Flag {
		cli.StringFlag {
			Name : "home, H",
			Usage : "specify an (alternate) home directory",
		},
		cli.StringFlag {
			Name : "server, s",
			Usage : "specify server API URI (default: https://api.keybase.io:443/)",
		},
		cli.StringFlag {
			Name : "config, c",
			Usage: "specify an (alternate) master config file",
		},
		cli.StringFlag {
			Name : "session",
			Usage : "specify an alternate session data file",
		},
		cli.StringFlag {
			Name : "db",
			Usage : "specify an alternate local DB location",
		},
		cli.StringFlag {
			Name : "api-uri-path-prefix",
			Usage : "specify an alternate API URI path prefix",
		},
		cli.StringFlag {
			Name : "username, u",
			Usage : "specify Keybase username of the current user",
		},
		cli.StringFlag {
			Name : "proxy",
			Usage : "specify an HTTP(s) proxy to ship all Web requests over",
		},
		cli.BoolFlag {
			Name : "debug, d",
			Usage : "enable debugging mode",
		},

	}
	app.Action = func (c *cli.Context) {
		p.ctx = c
	}
	p.app = app
	err := app.Run(args)
	return (p.ctx != nil), err
}
