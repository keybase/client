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

type CmdGitMdput struct {
	libkb.Contextified
	folder   string
	repoID   string
	repoName string
}

// NewCmdGitMdput creates a new cli.Command.
func NewCmdGitMdput(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "mdput",
		Usage:        "Encrypt and upload new repo metadata",
		ArgumentHelp: "<folder> <repoid> <reponame>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdGitMdput{Contextified: libkb.NewContextified(g)}, "mdput", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdGitMdput) Run() error {
	cli, err := GetGitClient(c.G())
	if err != nil {
		return err
	}

	folder, err := ParseTLF(c.folder)
	if err != nil {
		return err
	}
	ctx := context.Background()
	return cli.PutGitMetadata(ctx, keybase1.PutGitMetadataArg{
		Folder: folder,
		RepoID: keybase1.RepoID(c.repoID),
		Metadata: keybase1.GitLocalMetadata{
			RepoName: keybase1.GitRepoName(c.repoName),
		},
	})
}

// ParseArgv gets the secret phrase from the command args.
func (c *CmdGitMdput) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 3 {
		return fmt.Errorf("mdput takes three arguments")
	}
	c.folder = ctx.Args()[0]
	c.repoID = ctx.Args()[1]
	c.repoName = ctx.Args()[2]
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdGitMdput) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
