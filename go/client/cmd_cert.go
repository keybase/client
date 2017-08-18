// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdCert struct {
}

func (c *CmdCert) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdCert) Run() error {
	_, err := GlobUI.Println(libkb.BundledCAs["api.keybase.io"])
	return err
}

func NewCmdCert(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "cert",
		Usage: "Print the CA cert for api.keybase.io",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdCert{}, "cert", c)
		},
		Flags: []cli.Flag{},
	}
}

func (c *CmdCert) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: false,
		API:    false,
	}
}
