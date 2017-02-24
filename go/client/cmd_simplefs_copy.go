// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSCopy is the 'fs cp' command.
type CmdSimpleFSCopy struct {
	libkb.Contextified
	src         []keybase1.Path
	dest        keybase1.Path
	recurse     bool
	interactive bool
}

// NewCmdSimpleFSCopy creates a new cli.Command.
func NewCmdSimpleFSCopy(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "cp",
		ArgumentHelp: "<source> [source] <dest>",
		Usage:        "copy one or more directory elements to dest",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSCopy{Contextified: libkb.NewContextified(g)}, "cp", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "r, recursive",
				Usage: "Recurse into subdirectories",
			},
			cli.BoolFlag{
				Name:  "i, interactive",
				Usage: "Prompt before overwrite",
			},
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSCopy) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()

	c.G().Log.Debug("SimpleFSCopy to: %s", pathToString(c.dest))

	isDestDir, destPathString, err := checkPathIsDir(ctx, cli, c.dest)

	if err != nil {
		return err
	}

	for _, src := range c.src {
		c.G().Log.Debug("SimpleFSCopy %s -> %s, %v", pathToString(src), destPathString, isDestDir)

		dest, err := makeDestPath(c.G(), ctx, cli, src, c.dest, isDestDir, destPathString)
		if err == TargetFileExistsError && c.interactive == true {
			err = doOverwritePrompt(c.G(), pathToString(dest))
		}
		c.G().Log.Debug("SimpleFSCopy %s -> %s", pathToString(src), pathToString(dest))

		if err != nil {
			return err
		}

		opid, err := cli.SimpleFSMakeOpid(ctx)
		if err != nil {
			return err
		}
		defer cli.SimpleFSClose(ctx, opid)
		if c.recurse {
			err = cli.SimpleFSCopyRecursive(ctx, keybase1.SimpleFSCopyRecursiveArg{
				OpID: opid,
				Src:  src,
				Dest: dest,
			})
		} else {
			err = cli.SimpleFSCopy(ctx, keybase1.SimpleFSCopyArg{
				OpID: opid,
				Src:  src,
				Dest: dest,
			})
		}
		if err != nil {
			break
		}

		err = cli.SimpleFSWait(ctx, opid)
		if err != nil {
			break
		}
	}
	return err
}

// ParseArgv gets the rquired arguments for this command.
func (c *CmdSimpleFSCopy) ParseArgv(ctx *cli.Context) error {
	var err error

	c.recurse = ctx.Bool("recurse")
	c.interactive = ctx.Bool("interactive")

	c.src, c.dest, err = parseSrcDestArgs(c.G(), ctx, "cp")

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSCopy) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
