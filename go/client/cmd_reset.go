// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type CmdReset struct{}

const (
	resetPrompt = "Really delete all local cached state?"
)

func (v *CmdReset) Run() (err error) {
	if err = GlobUI.PromptForConfirmation(resetPrompt); err != nil {
		return
	}

	cli, err := GetLoginClient(G)
	if err != nil {
		return err
	}

	if err = RegisterProtocols(nil); err != nil {
		return err
	}

	return cli.Reset(context.TODO(), 0)
}

func NewCmdReset(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "reset",
		Usage: "Delete all local cached state",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdReset{}, "reset", c)
		},
	}
}

func (v *CmdReset) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (v *CmdReset) ParseArgv(*cli.Context) error { return nil }
