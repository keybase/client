// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type cmdTeamProfileLoad struct {
	libkb.Contextified
	arg keybase1.LoadTeamArg
}

func newCmdTeamProfileLoad(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "profile-load",
		Description:  "profile a team load operation",
		ArgumentHelp: "name",
		Flags:        []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdTeamProfileLoad{Contextified: libkb.NewContextified(g)}, "profile-load", c)
		},
	}
}

func (c *cmdTeamProfileLoad) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}
	c.arg.ForceFullReload = true
	res, err := cli.ProfileTeamLoad(context.TODO(), c.arg)
	if err != nil {
		return err
	}
	c.G().UI.GetTerminalUI().Printf("%+v\n", res)
	c.G().UI.GetTerminalUI().Printf("%v\n", time.Duration(res.LoadTimeNsec)*time.Nanosecond)
	return nil
}

func (c *cmdTeamProfileLoad) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("need a name argument")
	}
	c.arg.Name = ctx.Args()[0]
	return nil
}

func (c *cmdTeamProfileLoad) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
