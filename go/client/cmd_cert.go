package client

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"os"
)

type CmdCert struct {
}

func (c *CmdCert) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdCert) RunClient() error { return c.Run() }

func (c *CmdCert) Run() error {
	os.Stdout.Write([]byte(libkb.BundledCAs["api.keybase.io"] + "\n"))
	return nil
}

func NewCmdCert(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "cert",
		Usage:       "keybase cert",
		Description: "Print the CA cert for api.keybase.io",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCert{}, "cert", c)
		},
		Flags: []cli.Flag{},
	}
}

func (v *CmdCert) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: false,
		API:    false,
	}
}
