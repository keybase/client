// Copyright 2018 Keybase, Inc. All rights reserved. Use of
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

// CmdSimpleFSRecover is the 'fs recover' command.
type CmdSimpleFSRecover struct {
	libkb.Contextified
	src        []keybase1.Path
	opCanceler *OpCanceler
}

var _ Canceler = (*CmdSimpleFSRecover)(nil)

// NewCmdSimpleFSRecover creates a new cli.Command.
func NewCmdSimpleFSRecover(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "recover",
		ArgumentHelp: "<path> [<path2> <path3>...]",
		Usage:        "recovers the given files or directories from a past revision",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSRecover{
				Contextified: libkb.NewContextified(g),
				opCanceler:   NewOpCanceler(g),
			}, "recover", c)
			cl.SetNoStandalone()
		},
		Flags: []cli.Flag{
			cli.IntFlag{
				Name:  "rev",
				Usage: "a revision number for the KBFS recovery folder ",
			},
			cli.StringFlag{
				Name:  "time",
				Usage: "a time for the KBFS recovery folder (eg \"2018-07-27 22:05\")",
			},
			cli.StringFlag{
				Name:  "reltime, relative-time",
				Usage: "a relative time for the KBFS recovery folder (eg \"5m\")",
			},
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSRecover) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()

	srcPaths, err := doSimpleFSGlob(ctx, c.G(), cli, c.src)
	if err != nil {
		return err
	}

	for _, src := range srcPaths {
		dest := keybase1.NewPathWithKbfsPath(src.KbfsArchived().Path)
		c.G().Log.Debug("SimpleFSRecover %s -> %s", src, dest)

		// Don't spawn new jobs if we've been cancelled.  TODO: This
		// is still a race condition, if we get cancelled immediately
		// after.
		if c.opCanceler.IsCancelled() {
			break
		}

		opid, err := cli.SimpleFSMakeOpid(ctx)
		if err != nil {
			return err
		}
		c.opCanceler.AddOp(opid)

		err = cli.SimpleFSCopyRecursive(ctx, keybase1.SimpleFSCopyRecursiveArg{
			OpID: opid,
			Src:  src,
			Dest: dest,
		})
		if err != nil {
			return err
		}

		err = cli.SimpleFSWait(ctx, opid)
		if err != nil {
			return err
		}
	}
	return nil
}

// ParseArgv gets the required arguments for this command.
func (c *CmdSimpleFSRecover) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) < 1 {
		return errors.New("recover requires at least one KBFS path argument")
	}

	// TODO: "rev" should be a real int64, need to update the
	// `cli` library for that.
	rev := int64(ctx.Int("rev"))
	timeString := ctx.String("time")
	relTimeString := getRelTime(ctx)
	if rev == 0 && timeString == "" && relTimeString == "" {
		return errors.New(
			"must specify exactly one of -rev, -time, or -reltime")
	}

	for _, src := range ctx.Args() {
		p, err := makeSimpleFSPathWithArchiveParams(
			src, rev, timeString, relTimeString)
		if err != nil {
			return err
		}
		c.src = append(c.src, p)
	}
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSRecover) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}

func (c *CmdSimpleFSRecover) Cancel() error {
	return c.opCanceler.Cancel()
}
