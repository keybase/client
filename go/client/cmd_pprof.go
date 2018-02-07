// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdPprofTrace struct {
	libkb.Contextified
	traceFile            string
	traceDurationSeconds float64
}

func (c *CmdPprofTrace) ParseArgv(ctx *cli.Context) error {
	args := ctx.Args()
	if len(args) != 1 {
		return errors.New("Trace needs a single file path")
	}
	c.traceFile = args.First()
	c.traceDurationSeconds = ctx.Float64("duration")
	if c.traceDurationSeconds <= 0 {
		c.traceDurationSeconds = 5.0
	}
	return nil
}

func (c *CmdPprofTrace) Run() error {
	cli, err := GetPprofClient(c.G())
	if err != nil {
		return err
	}
	if err = RegisterProtocolsWithContext(nil, c.G()); err != nil {
		return err
	}
	return cli.Trace(context.TODO(), keybase1.TraceArg{
		SessionID:            0,
		TraceFile:            c.traceFile,
		TraceDurationSeconds: keybase1.DurationSec(c.traceDurationSeconds),
	})
}

func NewCmdPprofTrace(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "trace",
		ArgumentHelp: "/path/to/trace.out",
		Usage:        "Run an execution trace",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdPprofTraceRunner(g), "trace", c)
		},
		Flags: []cli.Flag{
			cli.DurationFlag{
				Name:  "duration, d",
				Usage: "Number of seconds to run the trace (default 5s).",
			},
		},
	}
}

func NewCmdPprofTraceRunner(g *libkb.GlobalContext) *CmdPprofTrace {
	return &CmdPprofTrace{
		Contextified: libkb.NewContextified(g),
	}
}

func NewCmdPprof(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "pprof",
		Subcommands: []cli.Command{
			NewCmdPprofTrace(cl, g),
		},
	}
}

func (c *CmdPprofTrace) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
