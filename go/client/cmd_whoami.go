// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdWhoami(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "whoami",
		Usage: "Output the name of the current user; will exit with a non-zero status if none",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdWhoami{Contextified: libkb.NewContextified(g)}, "whoami", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "uid",
				Usage: "Output the UID instead of the username",
			},
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "Output as JSON",
			},
		},
	}
}

type CmdWhoami struct {
	libkb.Contextified
	uid  bool
	json bool
}

func (c *CmdWhoami) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("whoami")
	}
	c.uid = ctx.Bool("uid")
	c.json = ctx.Bool("json")
	return nil
}

func (c *CmdWhoami) Run() error {
	cli, err := GetConfigClient(c.G())
	if err != nil {
		return err
	}

	status, err := cli.GetCurrentStatus(context.Background(), 0)
	if err != nil {
		return err
	}
	if c.json {
		b, err := json.MarshalIndent(status, "", "    ")
		if err != nil {
			return err
		}
		dui := c.G().UI.GetDumbOutputUI()
		_, err = dui.Printf(string(b) + "\n")
		return err
	}

	if !status.LoggedIn || status.User == nil {
		return errors.New("logged out")
	}
	dui := c.G().UI.GetDumbOutputUI()
	if c.uid {
		_, err = dui.Printf("%s\n", status.User.Uid)
	} else {
		_, err = dui.Printf("%s\n", status.User.Username)
	}
	return err
}

func (c *CmdWhoami) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
