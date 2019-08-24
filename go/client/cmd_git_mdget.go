// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdGitMdget struct {
	libkb.Contextified
	folder string
}

// NewCmdGitMdget creates a new cli.Command.
func NewCmdGitMdget(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "mdget",
		Usage:        "Fetch and decrypt repo metadata, printing the result as JSON",
		ArgumentHelp: "[<folder>]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdGitMdget{Contextified: libkb.NewContextified(g)}, "mdget", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdGitMdget) Run() error {
	cli, err := GetGitClient(c.G())
	ctx := context.Background()
	if err != nil {
		return err
	}

	var res []keybase1.GitRepoResult
	if len(c.folder) > 0 {
		folder, err := ParseTLF(c.folder)
		if err != nil {
			return err
		}
		res, err = cli.GetGitMetadata(ctx, folder)
		if err != nil {
			return err
		}
	} else {
		res, err = cli.GetAllGitMetadata(ctx)
		if err != nil {
			return err
		}
	}

	jsonStr, err := json.MarshalIndent(res, "", "    ")
	if err != nil {
		return err
	}

	fmt.Println(string(jsonStr))
	return nil
}

// ParseArgv gets the secret phrase from the command args.
func (c *CmdGitMdget) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) > 1 {
		return fmt.Errorf("mdget takes one optional argument")
	}
	if len(ctx.Args()) == 1 {
		c.folder = ctx.Args()[0]
	}
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdGitMdget) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
