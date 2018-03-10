// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"path/filepath"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdPprofTrace struct {
	libkb.Contextified
	writeToLogDir bool
	traceFile     string
	traceDuration time.Duration
}

func (c *CmdPprofTrace) ParseArgv(ctx *cli.Context) error {
	args := ctx.Args()
	argErr := errors.New("Trace needs a single file path or --log, and not both")
	writeToLogDir := ctx.Bool("log")
	if len(args) == 0 && writeToLogDir {
		c.writeToLogDir = true
	} else if len(args) == 1 && !writeToLogDir {
		absPath, err := filepath.Abs(args.First())
		if err != nil {
			return err
		}
		c.traceFile = absPath
	} else {
		return argErr
	}

	c.traceDuration = ctx.Duration("duration")
	if c.traceDuration <= 0 {
		return fmt.Errorf("Invalid duration %s", c.traceDuration)
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

	durationSeconds := keybase1.DurationSec(c.traceDuration.Seconds())
	if c.writeToLogDir {
		return cli.LogTrace(context.TODO(), keybase1.LogTraceArg{
			SessionID:            0,
			TraceDurationSeconds: durationSeconds,
		})
	}
	return cli.Trace(context.TODO(), keybase1.TraceArg{
		SessionID:            0,
		TraceFile:            c.traceFile,
		TraceDurationSeconds: durationSeconds,
	})
}

func NewCmdPprofTrace(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "trace",
		ArgumentHelp: "[/path/to/trace.out]",
		Usage:        "Run an execution trace asynchronously.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdPprofTraceRunner(g), "trace", c)
		},
		Flags: []cli.Flag{
			cli.DurationFlag{
				Name:  "duration, d",
				Value: 5 * time.Second,
				Usage: "How long to run the trace.",
			},
			cli.BoolFlag{
				Name:  "log, l",
				Usage: "Whether to write the trace to the log directory so that it gets included in a log send. If set, don't pass an argument.",
			},
		},
	}
}

func NewCmdPprofTraceRunner(g *libkb.GlobalContext) *CmdPprofTrace {
	return &CmdPprofTrace{
		Contextified: libkb.NewContextified(g),
	}
}

type CmdPprofCPU struct {
	libkb.Contextified
	writeToLogDir   bool
	profileFile     string
	profileDuration time.Duration
}

func (c *CmdPprofCPU) ParseArgv(ctx *cli.Context) error {
	args := ctx.Args()
	argErr := errors.New("CPU profile needs a single file path or --log, and not both")
	writeToLogDir := ctx.Bool("log")
	if len(args) == 0 && writeToLogDir {
		c.writeToLogDir = true
	} else if len(args) == 1 && !writeToLogDir {
		absPath, err := filepath.Abs(args.First())
		if err != nil {
			return err
		}
		c.profileFile = absPath
	} else {
		return argErr
	}

	c.profileDuration = ctx.Duration("duration")
	if c.profileDuration <= 0 {
		return fmt.Errorf("Invalid duration %s", c.profileDuration)
	}
	return nil
}

func (c *CmdPprofCPU) Run() error {
	cli, err := GetPprofClient(c.G())
	if err != nil {
		return err
	}
	if err = RegisterProtocolsWithContext(nil, c.G()); err != nil {
		return err
	}

	durationSeconds := keybase1.DurationSec(c.profileDuration.Seconds())
	if c.writeToLogDir {
		return cli.LogProcessorProfile(context.TODO(), keybase1.LogProcessorProfileArg{
			SessionID:              0,
			ProfileDurationSeconds: durationSeconds,
		})
	}
	return cli.ProcessorProfile(context.TODO(), keybase1.ProcessorProfileArg{
		SessionID:              0,
		ProfileFile:            c.profileFile,
		ProfileDurationSeconds: durationSeconds,
	})
}

func NewCmdPprofCPU(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "cpu",
		ArgumentHelp: "[/path/to/cpu.profile.out]",
		Usage:        "Run an CPU profile asynchronously.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdPprofCPURunner(g), "cpu", c)
		},
		Flags: []cli.Flag{
			cli.DurationFlag{
				Name:  "duration, d",
				Value: 5 * time.Second,
				Usage: "How long to run the trace.",
			},
			cli.BoolFlag{
				Name:  "log, l",
				Usage: "Whether to write the CPU profile to the log directory so that it gets included in a log send. If set, don't pass an argument.",
			},
		},
	}
}

func NewCmdPprofCPURunner(g *libkb.GlobalContext) *CmdPprofCPU {
	return &CmdPprofCPU{
		Contextified: libkb.NewContextified(g),
	}
}

func NewCmdPprof(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "pprof",
		Subcommands: []cli.Command{
			NewCmdPprofTrace(cl, g),
			NewCmdPprofCPU(cl, g),
		},
	}
}

func (c *CmdPprofTrace) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (c *CmdPprofCPU) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
