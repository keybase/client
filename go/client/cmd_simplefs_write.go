// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bufio"
	"fmt"
	"io"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const writeBufSizeDefault = 1600

// CmdSimpleFSWrite is the 'fs write' command.
type CmdSimpleFSWrite struct {
	libkb.Contextified
	path    keybase1.Path
	flags   keybase1.OpenFlags
	offset  int64
	bufSize int
}

// NewCmdSimpleFSWrite creates a new cli.Command.
func NewCmdSimpleFSWrite(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "write",
		ArgumentHelp: "<path>",
		Usage:        "write input to file",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSWrite{Contextified: libkb.NewContextified(g)}, "write", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "a, append",
				Usage: "add to existing file",
			},
			cli.IntFlag{
				Name:  "b, buffersize",
				Value: writeBufSizeDefault,
				Usage: "write buffer size",
			},
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSWrite) Run() error {

	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()

	opid, err := cli.SimpleFSMakeOpid(ctx)
	if err != nil {
		return err
	}

	// if we're appending, we'll need the size
	if c.flags&keybase1.OpenFlags_APPEND != 0 {
		e, err := cli.SimpleFSStat(context.TODO(), c.path)
		if err != nil {
			return err
		}
		c.offset = int64(e.Size)
	}

	err = cli.SimpleFSOpen(context.TODO(), keybase1.SimpleFSOpenArg{
		OpID:  opid,
		Dest:  c.path,
		Flags: c.flags,
	})
	if err != nil {
		return err
	}
	defer cli.SimpleFSClose(context.TODO(), opid)

	buf := make([]byte, 0, c.bufSize)
	r := bufio.NewReader(os.Stdin)

	for {
		n, err := r.Read(buf[:cap(buf)])
		buf = buf[:n]
		if n == 0 {
			if err == nil {
				continue
			}
			if err == io.EOF {
				break
			}
		}

		err2 := cli.SimpleFSWrite(context.TODO(), keybase1.SimpleFSWriteArg{
			OpID:    opid,
			Offset:  c.offset,
			Content: buf[:],
		})
		if err2 != nil {
			err = err2
			break
		}
		c.offset += int64(n)

		if err != nil {
			if err == io.EOF {
				err = nil
			}
			break
		}
	}
	c.G().Log.Debug("SimpleFS: return with error %v", err)
	return err
}

// ParseArgv gets the arguments for this command.
func (c *CmdSimpleFSWrite) ParseArgv(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	c.bufSize = ctx.Int("buffersize")

	if ctx.Bool("append") {
		c.flags = keybase1.OpenFlags_WRITE | keybase1.OpenFlags_APPEND | keybase1.OpenFlags_EXISTING
	} else {
		c.flags = keybase1.OpenFlags_WRITE | keybase1.OpenFlags_REPLACE
	}

	if nargs == 1 {
		c.path = makeSimpleFSPath(c.G(), ctx.Args()[0])
	} else {
		err = fmt.Errorf("write requires a path argument")
	}

	return err
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSWrite) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
