
package libkb

import (
	"github.com/codegangsta/cli"
	"fmt"
)

type PosixCommandLine struct {
	app *cli.App
	ctx *cli.Context
}

func (p PosixCommandLine) GetHome() string { return p.GetGString("home"); }
func (p PosixCommandLine) GetServerUri() string { return p.GetGString("server"); }
func (p PosixCommandLine) GetConfigFilename() string { return p.GetGString("config"); }
func (p PosixCommandLine) GetSessionFilename() string { return p.GetGString("session"); }
func (p PosixCommandLine) GetDbFilename() string { return p.GetGString("db"); }
func (p PosixCommandLine) GetDebug() (bool, bool) { return p.GetBool("debug", true) }
func (p PosixCommandLine) GetApiUriPathPrefix() string { return p.GetGString("api-uri-path-prefix"); }
func (p PosixCommandLine) GetUsername() string { return p.GetGString("username") }
func (p PosixCommandLine) GetProxy() string { return p.GetGString("proxy") }
func (p PosixCommandLine) GetPlainLogging() (bool, bool) { return p.GetBool("plain-logging", true); }
func (p PosixCommandLine) GetPgpDir() string { return p.GetGString("pgpdir") }


func (p PosixCommandLine) GetGString(s string) string { return p.ctx.GlobalString(s) }


func (p PosixCommandLine) GetBool(s string, glbl bool) (bool, bool) {
	var v bool
	if glbl {
		v = p.ctx.GlobalBool(s);
	} else {
		v = p.ctx.Bool(s)
	}
	return v, v
}

type CmdHelp struct {
	ctx *cli.Context
}

func (c CmdHelp) UseConfig() bool { return false }
func (c CmdHelp) UseKeychain() bool { return false }
func (c CmdHelp) Run() error {
	cli.ShowAppHelp(c.ctx)
	return nil
}

func (p *PosixCommandLine) Parse(args []string) (Command, error) {
	var cmd Command
	app := cli.NewApp()
	app.Name = "keybase"
	app.Version = CLIENT_VERSION
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
		cli.BoolFlag {
			Name :"plain-logging, L",
			Usage : "plain logging mode (no colors)",
		},
		cli.StringFlag {
			Name : "pgpdir, gpgdir",
			Usage : "specify a PGP directory (default is ~/.gnupg)",
		},
	}
	app.Commands = []cli.Command {
		{
			Name : "version",
			Usage : "print out version information",
			Action : func (c *cli.Context) {
				p.ctx = c
				cmd = CmdVersion {}
			},
		},
	}
	app.Action = func (c *cli.Context) {
		p.ctx = c
		cmd = CmdHelp { c }
	}
	p.app = app
	err := app.Run(args)
	if err != nil && p.ctx == nil {
		err = fmt.Errorf("Problem: no context found")
	}
	return cmd, err
}
