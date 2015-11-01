// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package client

import (
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdPing struct{}

func (v *CmdPing) Run() error {
	_, err := G.API.Post(libkb.APIArg{Endpoint: "ping"})
	if err != nil {
		return err
	}
	_, err = G.API.Get(libkb.APIArg{Endpoint: "ping"})
	if err != nil {
		return err
	}
	G.Log.Info(fmt.Sprintf("API Server at %s is up", G.Env.GetServerURI()))
	return nil
}

func NewCmdPing(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "ping",
		Usage: "Ping the keybase API server",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdPing{}, "ping", c)
		},
	}
}

func (v *CmdPing) ParseArgv(*cli.Context) error { return nil }

func (v *CmdPing) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
