// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

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
	force       bool
	opCanceler  *OpCanceler
}

var _ Canceler = (*CmdSimpleFSCopy)(nil)

// NewCmdSimpleFSCopy creates a new cli.Command.
func NewCmdSimpleFSCopy(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "cp",
		ArgumentHelp: "<source> [source] <dest>",
		Usage:        "copy one or more directory elements to dest",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSCopy{
				Contextified: libkb.NewContextified(g),
				opCanceler:   NewOpCanceler(g),
			}, "cp", c)
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
			cli.BoolFlag{
				Name:  "f, force",
				Usage: "force overwrite",
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

	c.G().Log.Debug("SimpleFSCopy (recursive: %v) to: %s", c.recurse, pathToString(c.dest))

	destPaths, err := doSimpleFSGlob(ctx, c.G(), cli, c.src)
	if err != nil {
		return err
	}

	// Eat the error because it's ok here if the dest doesn't exist
	isDestDir, destPathString, _ := checkPathIsDir(ctx, cli, c.dest)

	for _, src := range destPaths {
		var dest keybase1.Path
		dest, err = makeDestPath(ctx, c.G(), cli, src, c.dest, isDestDir, destPathString)
		c.G().Log.Debug("SimpleFSCopy %s -> %s, %v", pathToString(src), pathToString(dest), isDestDir)

		if err == ErrTargetFileExists {
			if c.interactive == true {
				err = doOverwritePrompt(c.G(), pathToString(dest))
			} else if c.force == true {
				err = nil
			}
		}

		if err != nil {
			c.G().Log.Debug("SimpleFSCopy can't get paths together")
			return err
		}

		// Don't spawn new jobs if we've been cancelled.
		// TODO: This is still a race condition, if we get cancelled immediately after.
		if c.opCanceler.IsCancelled() {
			break
		}

		opid, err2 := cli.SimpleFSMakeOpid(ctx)
		if err2 != nil {
			return err2
		}
		c.opCanceler.AddOp(opid)

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

	c.recurse = ctx.Bool("recursive")
	c.interactive = ctx.Bool("interactive")
	c.force = ctx.Bool("force")

	if c.force && c.interactive {
		return errors.New("force and interactive are incompatible")
	}

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

func (c *CmdSimpleFSCopy) Cancel() error {
	return c.opCanceler.Cancel()
}
