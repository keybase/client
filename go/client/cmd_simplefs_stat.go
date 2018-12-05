// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSStat is the 'fs stat' command.
type CmdSimpleFSStat struct {
	libkb.Contextified
	path     keybase1.Path
	spanType *keybase1.RevisionSpanType
}

// NewCmdSimpleFSStat creates a new cli.Command.
func NewCmdSimpleFSStat(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "stat",
		ArgumentHelp: "<path>",
		Usage:        "stat directory element",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSStat{Contextified: libkb.NewContextified(g)}, "stat", c)
			cl.SetNoStandalone()
		},
		Flags: []cli.Flag{
			cli.IntFlag{
				Name:  "rev",
				Usage: "a revision number for the KBFS folder",
			},
			cli.StringFlag{
				Name:  "time",
				Usage: "a time for the KBFS folder (eg \"2018-07-27 22:05\")",
			},
			cli.StringFlag{
				Name:  "reltime, relative-time",
				Usage: "a relative time for the KBFS folder (eg \"5m\")",
			},
			cli.BoolFlag{
				Name:  "show-archived",
				Usage: "shows stats for several previous revisions",
			},
			cli.BoolFlag{
				Name:  "show-last-archived",
				Usage: "shows stats for sequential previous revisions",
			},
		},
	}
}

func prefetchStatusString(e keybase1.Dirent) string {
	if e.PrefetchStatus != keybase1.PrefetchStatus_IN_PROGRESS {
		return e.PrefetchStatus.String()
	}

	if e.PrefetchProgress.BytesTotal == 0 {
		return keybase1.PrefetchStatus_NOT_STARTED.String()
	}

	return fmt.Sprintf("%.2f%%",
		100*float64(e.PrefetchProgress.BytesFetched)/
			float64(e.PrefetchProgress.BytesTotal))
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSStat) Run() (err error) {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	ui.Printf("%v\n", c.path)
	ctx := context.TODO()

	if c.spanType != nil {
		opid, err := cli.SimpleFSMakeOpid(ctx)
		if err != nil {
			return err
		}
		defer func() {
			closeErr := cli.SimpleFSClose(ctx, opid)
			if err == nil {
				err = closeErr
			}
		}()
		err = cli.SimpleFSGetRevisions(ctx, keybase1.SimpleFSGetRevisionsArg{
			OpID:     opid,
			Path:     c.path,
			SpanType: *c.spanType,
		})
		if err != nil {
			return err
		}
		err = cli.SimpleFSWait(ctx, opid)
		if err != nil {
			return err
		}
		res, err := cli.SimpleFSReadRevisions(ctx, opid)
		if err != nil {
			return err
		}

		for _, r := range res.Revisions {
			e := r.Entry
			ui.Printf("%d)\t%s\t%s\t%d\t%s\t%s\t%s\n",
				r.Revision, keybase1.FormatTime(e.Time),
				keybase1.DirentTypeRevMap[e.DirentType],
				e.Size, e.Name, e.LastWriterUnverified.Username,
				prefetchStatusString(e))
		}
	} else {
		e, err := cli.SimpleFSStat(ctx, keybase1.SimpleFSStatArg{Path: c.path})
		if err != nil {
			return err
		}

		ui.Printf("%s\t%s\t%d\t%s\t%s\t%s\n",
			keybase1.FormatTime(e.Time),
			keybase1.DirentTypeRevMap[e.DirentType],
			e.Size, e.Name, e.LastWriterUnverified.Username,
			prefetchStatusString(e))
	}

	return nil
}

// ParseArgv gets the required path argument for this command.
func (c *CmdSimpleFSStat) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	if nargs != 1 {
		return errors.New("stat requires a KBFS path argument")
	}

	// TODO: "rev" should be a real int64, need to update the
	// `cli` library for that.
	p, err := makeSimpleFSPathWithArchiveParams(
		ctx.Args()[0], int64(ctx.Int("rev")), ctx.String("time"),
		getRelTime(ctx))
	if err != nil {
		return err
	}
	c.path = p

	if ctx.Bool("show-archived") {
		st := keybase1.RevisionSpanType_DEFAULT
		c.spanType = &st
	}
	if ctx.Bool("show-last-archived") {
		if c.spanType != nil {
			return errors.New("Cannot specify both -show-archived and " +
				"-show-last-archived")
		}
		st := keybase1.RevisionSpanType_LAST_FIVE
		c.spanType = &st
	}

	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSStat) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
