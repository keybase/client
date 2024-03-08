// Copyright 2024 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"sort"

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
			NewCmdSimpleFSArchiveCancelOrDismiss(cl, g),
			NewCmdSimpleFSArchiveStatus(cl, g),
		},
	}
}

// CmdSimpleFSArchiveStart is the 'fs archive start' command.
type CmdSimpleFSArchiveStart struct {
	libkb.Contextified
	outputPath   string
	kbfsPath     keybase1.KBFSPath
	overwriteZip bool
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
			cli.BoolFlag{
				Name:  "f, overwrite-zip",
				Usage: "[optional] overwrite zip file if it already exists",
			},
		},
		ArgumentHelp: "<KBFS path>",
	}
}

func printSimpleFSArchiveJobDesc(ui libkb.TerminalUI, desc *keybase1.SimpleFSArchiveJobDesc, currentTLFRevision *keybase1.KBFSRevision) {
	revisionExtendedDescription := func() string {
		if currentTLFRevision == nil {
			return ""
		}
		jobRevision := desc.KbfsPathWithRevision.ArchivedParam.Revision()
		if jobRevision == *currentTLFRevision {
			return " (up to date with TLF)"
		}

		return fmt.Sprintf(" (behind TLF @ %d)", *currentTLFRevision)
	}()

	ui.Printf("Job ID: %s\n", desc.JobID)
	ui.Printf("Path: %s\n", desc.KbfsPathWithRevision.Path)
	ui.Printf("TLF Revision: %v%s\n", desc.KbfsPathWithRevision.ArchivedParam.Revision(), revisionExtendedDescription)
	ui.Printf("Started: %s\n", desc.StartTime.Time())
	ui.Printf("Staging Path: %s\n", desc.StagingPath)
	ui.Printf("Zip File Path: %s\n", desc.ZipFilePath)

}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSArchiveStart) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	desc, err := cli.SimpleFSArchiveStart(context.TODO(),
		keybase1.SimpleFSArchiveStartArg{
			OutputPath:   c.outputPath,
			KbfsPath:     c.kbfsPath,
			OverwriteZip: c.overwriteZip,
		})
	if err != nil {
		return err
	}

	printSimpleFSArchiveJobDesc(c.G().UI.GetTerminalUI(), &desc, nil)

	return nil
}

// ParseArgv parses the arguments.
func (c *CmdSimpleFSArchiveStart) ParseArgv(ctx *cli.Context) error {
	c.outputPath = ctx.String("output-path")
	p, err := makeSimpleFSPathWithArchiveParams(ctx.Args().First(), 0, "", "")
	if err != nil {
		return err
	}
	c.kbfsPath = p.Kbfs()
	c.overwriteZip = ctx.Bool("overwrite-zip")
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

// CmdSimpleFSArchiveCancelOrDismiss is the 'fs archive dismiss' and `fs
// archive cancel' commands.
type CmdSimpleFSArchiveCancelOrDismiss struct {
	libkb.Contextified
	jobIDs []string
}

// NewCmdSimpleFSArchiveCancelOrDismiss creates a new cli.Command.
func NewCmdSimpleFSArchiveCancelOrDismiss(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:    "dismiss",
		Aliases: []string{"cancel"},
		Usage:   "cancel or dismiss a KBFS archiving job",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSArchiveCancelOrDismiss{
				Contextified: libkb.NewContextified(g)}, "dismiss", c)
			cl.SetNoStandalone()
		},
		ArgumentHelp: "<job ID>...",
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSArchiveCancelOrDismiss) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	for _, jobID := range c.jobIDs {
		err = cli.SimpleFSArchiveCancelOrDismissJob(context.TODO(), jobID)
		if err != nil {
			return err
		}
	}

	return nil
}

// ParseArgv parses the arguments.
func (c *CmdSimpleFSArchiveCancelOrDismiss) ParseArgv(ctx *cli.Context) error {
	c.jobIDs = ctx.Args()
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSArchiveCancelOrDismiss) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}

// CmdSimpleFSArchiveStatus is the 'fs archive status' command.
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

	status, err := cli.SimpleFSGetArchiveStatus(context.TODO())
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()

	ui.Printf("=== [Last updated: %v] ===\n\n", status.LastUpdated.Time())
	jobIDs := make([]string, 0, len(status.Jobs))
	for jobID := range status.Jobs {
		jobIDs = append(jobIDs, jobID)
	}
	sort.Slice(jobIDs, func(i, j int) bool {
		return status.Jobs[jobIDs[i]].Desc.StartTime.Before(status.Jobs[jobIDs[j]].Desc.StartTime)
	})
	for _, jobID := range jobIDs {
		job := status.Jobs[jobID]
		printSimpleFSArchiveJobDesc(ui, &job.Desc, &job.CurrentTLFRevision)
		{
			ui.Printf("Phase: %s ", job.Phase.String())
			if job.Phase == keybase1.SimpleFSArchiveJobPhase_Copying {
				ui.Printf("(%d%%, %d / %d bytes)\n", job.BytesCopied*100/job.BytesTotal, job.BytesCopied, job.BytesTotal)
			} else if job.Phase == keybase1.SimpleFSArchiveJobPhase_Zipping {
				ui.Printf("(%d%%, %d / %d bytes)\n", job.BytesZipped*100/job.BytesTotal, job.BytesZipped, job.BytesTotal)
			} else {
				ui.Printf("\n")
			}
			ui.Printf("       (all phases:")
			for _, p := range []keybase1.SimpleFSArchiveJobPhase{
				keybase1.SimpleFSArchiveJobPhase_Queued,
				keybase1.SimpleFSArchiveJobPhase_Indexing,
				keybase1.SimpleFSArchiveJobPhase_Indexed,
				keybase1.SimpleFSArchiveJobPhase_Copying,
				keybase1.SimpleFSArchiveJobPhase_Copied,
				keybase1.SimpleFSArchiveJobPhase_Zipping,
				keybase1.SimpleFSArchiveJobPhase_Done,
			} {
				if p == job.Phase {
					ui.Printf(" <%s>", p.String())
				} else {
					ui.Printf(" %s", p.String())
				}
			}
			ui.Printf(")\n")
		}
		ui.Printf("To Do: %d\nIn Progress: %d\nComplete: %d\nSkipped: %d\nTotal: %d\n",
			job.TodoCount, job.InProgressCount, job.CompleteCount, job.SkippedCount, job.TotalCount)
		if job.Error != nil {
			ui.Printf("Error: %s\n", job.Error.Error)
			ui.Printf("Next Retry: %s\n", job.Error.NextRetry.Time())
		}
		ui.Printf("\n")
	}

	return nil
}

// ParseArgv parses the arguments.
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
