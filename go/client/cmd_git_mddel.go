// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdGitMddel struct {
	libkb.Contextified
	folder   string
	repoName string
}

// NewCmdGitMddel creates a new cli.Command.
func NewCmdGitMddel(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "mddel",
		Usage:        "Delete repo metadata",
		ArgumentHelp: "<folder> <reponame>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdGitMddel{Contextified: libkb.NewContextified(g)}, "mddel", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdGitMddel) Run() error {
	cli, err := GetGitClient(c.G())
	if err != nil {
		return err
	}

	folder, err := ParseTLF(c.folder)
	if err != nil {
		return err
	}

	return cli.DeleteGitMetadata(context.Background(), keybase1.DeleteGitMetadataArg{
		Folder:   folder,
		RepoName: keybase1.GitRepoName(c.repoName),
	})
}

// ParseArgv gets the secret phrase from the command args.
func (c *CmdGitMddel) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 2 {
		return fmt.Errorf("mddel takes two arguments")
	}
	c.folder = ctx.Args()[0]
	c.repoName = ctx.Args()[1]
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdGitMddel) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
