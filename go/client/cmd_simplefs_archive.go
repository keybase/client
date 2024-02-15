// Copyright 2024 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// NewCmdSimpleFSArchive creates a new cli.Command.
func NewCmdSimpleFSArchive(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "archive",
		Usage: "manage KBFS archiving activities",
		Subcommands: []cli.Command{
			NewCmdSimpleFSArchiveStart(cl, g),
			NewCmdSimpleFSArchiveStatus(cl, g),
		},
	}
}

// CmdSimpleFSArchiveStart is the 'fs uploads' command.
type CmdSimpleFSArchiveStart struct {
	libkb.Contextified
	jobID      string
	outputPath string
	kbfsPath   keybase1.KBFSPath
}

// NewCmdSimpleFSArchiveStart creates a new cli.Command.
func NewCmdSimpleFSArchiveStart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "start",
		Usage: "start archiving a KBFS path",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSArchiveStart{
				Contextified: libkb.NewContextified(g)}, "start", c)
			cl.SetNoStandalone()
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "j, job-id",
				Usage: "[optional] specify a job ID",
			},
			cli.StringFlag{
				Name:  "o, output-path",
				Usage: "[optional] specify a output path",
			},
		},
		ArgumentHelp: "<KBFS path>",
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSArchiveStart) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	_, err = cli.SimpleFSArchiveStart(context.TODO(),
		keybase1.SimpleFSArchiveStartArg{
			JobID:      c.jobID,
			OutputPath: c.outputPath,
			KbfsPath:   c.kbfsPath,
		})
	if err != nil {
		return err
	}

	return nil
}

// ParseArgv gets the optional -a switch.
func (c *CmdSimpleFSArchiveStart) ParseArgv(ctx *cli.Context) error {
	c.jobID = ctx.String("job-id")
	c.outputPath = ctx.String("output-path")
	p, err := makeSimpleFSPathWithArchiveParams(ctx.Args().First(), 0, "", "")
	if err != nil {
		return err
	}
	c.kbfsPath = p.Kbfs()
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSArchiveStart) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}

// CmdSimpleFSArchiveStatus is the 'fs uploads' command.
type CmdSimpleFSArchiveStatus struct {
	libkb.Contextified
}

// NewCmdSimpleFSArchiveStatus creates a new cli.Command.
func NewCmdSimpleFSArchiveStatus(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "status",
		Usage: "display the status of all archiving activities",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSArchiveStatus{
				Contextified: libkb.NewContextified(g)}, "status", c)
			cl.SetNoStandalone()
		},
		Flags: []cli.Flag{},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSArchiveStatus) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	status, err := cli.SimpleFSGetArchiveState(context.TODO())
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	ui.Printf("%#+v", status)

	return nil
}

// ParseArgv gets the optional -a switch.
func (c *CmdSimpleFSArchiveStatus) ParseArgv(ctx *cli.Context) error {
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSArchiveStatus) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
