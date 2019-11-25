// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type cmdWebAuthToken struct {
	libkb.Contextified
}

func newCmdWebAuthToken(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:        "web-auth-token",
		Description: "Generate a Web auth token for the current user",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdWebAuthToken{Contextified: libkb.NewContextified(g)}, "web-auth-token", c)
		},
	}
}

func (c *cmdWebAuthToken) Run() error {
	configClient, err := GetConfigClient(c.G())
	if err != nil {
		return err
	}
	tok, err := configClient.GenerateWebAuthToken(context.Background())
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	_, _ = dui.Printf("%s\n", tok)
	return nil
}

func (c *cmdWebAuthToken) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("no arguments allowed")
	}
	return nil
}

func (c *cmdWebAuthToken) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
