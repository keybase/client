// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const readBufSizeDefault = 1600

// CmdSimpleFSRead is the 'fs read' command.
type CmdSimpleFSRead struct {
	libkb.Contextified
	path    keybase1.Path
	bufSize int
}

// NewCmdSimpleFSRead creates a new cli.Command.
func NewCmdSimpleFSRead(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "read",
		ArgumentHelp: "<path>",
		Usage:        "output file contents to standard output",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSRead{Contextified: libkb.NewContextified(g)}, "read", c)
			cl.SetNoStandalone()
		},
		Flags: []cli.Flag{
			cli.IntFlag{
				Name:  "b, buffersize",
				Value: readBufSizeDefault,
				Usage: "read buffer size",
			},
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
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSRead) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()

	opid, err2 := cli.SimpleFSMakeOpid(ctx)
	if err2 != nil {
		return err2
	}
	err = cli.SimpleFSOpen(ctx, keybase1.SimpleFSOpenArg{
		OpID:  opid,
		Dest:  c.path,
		Flags: keybase1.OpenFlags_READ | keybase1.OpenFlags_EXISTING,
	})
	if err != nil {
		return err
	}
	defer cli.SimpleFSClose(ctx, opid)
	var offset int64
	for {
		c.G().Log.Debug("SimpleFS: Reading at %d", offset)

		content, err := cli.SimpleFSRead(ctx, keybase1.SimpleFSReadArg{
			OpID:   opid,
			Offset: offset,
			Size:   c.bufSize,
		})
		if err != nil {
			return err
		}
		c.G().Log.Debug("SimpleFS: Read %d", len(content.Data))

		if len(content.Data) > 0 {
			offset += int64(len(content.Data))
			c.output(content.Data)
		} else {
			break
		}
	}

	return err
}

func (c *CmdSimpleFSRead) output(data []byte) {
	ui := c.G().UI.GetTerminalUI()
	_, _ = ui.UnescapedOutputWriter().Write(data)
}

// ParseArgv does nothing for this command.
func (c *CmdSimpleFSRead) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	c.bufSize = ctx.Int("buffersize")

	if nargs != 1 {
		return fmt.Errorf("read requires a path argument")
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
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSRead) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
