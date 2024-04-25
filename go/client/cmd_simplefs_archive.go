// Copyright 2024 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

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
			NewCmdSimpleFSArchiveCheckArchive(cl, g),
			NewCmdSimpleFSArchiveStatus(cl, g),
		},
	}
}

// CmdSimpleFSArchiveStart is the 'fs archive start' command.
type CmdSimpleFSArchiveStart struct {
	libkb.Contextified
	outputPath   string
	target       keybase1.ArchiveJobStartPath
	overwriteZip bool
}

// NewCmdSimpleFSArchiveStart creates a new cli.Command.
func NewCmdSimpleFSArchiveStart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "start",
		Usage: "start archiving a KBFS path or git repo",
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
			cli.BoolFlag{
				Name:  "g, git",
				Usage: "[optional] treat <archiving target> as a git repo instead of KBFS directory",
			},
		},
		ArgumentHelp: "<archiving target>",
	}
}
func revisionExtendedDescription(currentTLFRevision keybase1.KBFSRevision, desc *keybase1.SimpleFSArchiveJobDesc) string {
	if currentTLFRevision == 0 {
		return ""
	}
	jobRevision := desc.KbfsPathWithRevision.ArchivedParam.Revision()
	if jobRevision == currentTLFRevision {
		return " (up to date with TLF)"
	}

	return fmt.Sprintf(" (behind TLF @ %d)", currentTLFRevision)
}

func printSimpleFSArchiveJobDesc(ui libkb.TerminalUI, desc *keybase1.SimpleFSArchiveJobDesc, currentTLFRevision keybase1.KBFSRevision) {
	ui.Printf("Job ID: %s\n", desc.JobID)
	if desc.GitRepo != nil {
		ui.Printf("Git Repo: %s\n", *desc.GitRepo)
		ui.Printf("  (Path: %s)\n", desc.KbfsPathWithRevision.Path)
	} else {
		ui.Printf("Path: %s\n", desc.KbfsPathWithRevision.Path)
	}
	ui.Printf("TLF Revision: %v%s\n", desc.KbfsPathWithRevision.ArchivedParam.Revision(), revisionExtendedDescription(currentTLFRevision, desc))
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
			OutputPath:          c.outputPath,
			ArchiveJobStartPath: c.target,
			OverwriteZip:        c.overwriteZip,
		})
	if err != nil {
		return err
	}

	printSimpleFSArchiveJobDesc(c.G().UI.GetTerminalUI(), &desc, 0)

	return nil
}

// ParseArgv parses the arguments.
func (c *CmdSimpleFSArchiveStart) ParseArgv(ctx *cli.Context) error {
	if ctx.Bool("git") {
		c.target = keybase1.NewArchiveJobStartPathWithGit(ctx.Args().First())
	} else {
		p, err := makeSimpleFSPathWithArchiveParams(ctx.Args().First(), 0, "", "")
		if err != nil {
			return err
		}
		c.target = keybase1.NewArchiveJobStartPathWithKbfs(p.Kbfs())
	}
	c.outputPath = ctx.String("output-path")
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

	ctx := context.Background()
	status, err := cli.SimpleFSGetArchiveStatus(ctx)
	if err != nil {
		return err
	}

	currentTLFRevisions := make(map[string]keybase1.KBFSRevision, len(status.Jobs))
	for _, job := range status.Jobs {
		resp, err := cli.SimpleFSGetArchiveJobFreshness(ctx, job.Desc.JobID)
		if err != nil {
			return err
		}
		currentTLFRevisions[job.Desc.JobID] = resp.CurrentTLFRevision
	}

	ui := c.G().UI.GetTerminalUI()

	ui.Printf("=== [Last updated: %v] ===\n\n", status.LastUpdated.Time())
	for _, job := range status.Jobs {
		printSimpleFSArchiveJobDesc(ui, &job.Desc, currentTLFRevisions[job.Desc.JobID])
		{
			ui.Printf("Phase: %s ", job.Phase.String())
			if job.Phase == keybase1.SimpleFSArchiveJobPhase_Copying {
				percentage := int64(0)
				if job.BytesTotal != 0 {
					percentage = job.BytesCopied * 100 / job.BytesTotal
				}
				ui.Printf("(%d%%, %d / %d bytes)\n", percentage, job.BytesCopied, job.BytesTotal)
			} else if job.Phase == keybase1.SimpleFSArchiveJobPhase_Zipping {
				percentage := int64(0)
				if job.BytesTotal != 0 {
					percentage = job.BytesZipped * 100 / job.BytesTotal
				}
				ui.Printf("(%d%%, %d / %d bytes)\n", percentage, job.BytesZipped, job.BytesTotal)
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

// CmdSimpleFSArchiveCheckArchive is the 'fs archive check'command.
type CmdSimpleFSArchiveCheckArchive struct {
	libkb.Contextified
	zipFilePaths []string
}

// NewCmdSimpleFSArchiveCheckArchive creates a new cli.Command.
func NewCmdSimpleFSArchiveCheckArchive(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:    "check",
		Aliases: []string{"check"},
		Usage:   "check one or more previously created KBFS archive(s)",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSArchiveCheckArchive{
				Contextified: libkb.NewContextified(g)}, "check", c)
			cl.SetNoStandalone()
		},
		ArgumentHelp: "<KBFS archive zip file path>...",
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSArchiveCheckArchive) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}
	ui := c.G().UI.GetTerminalUI()

	for _, zipFilePath := range c.zipFilePaths {
		res, err := cli.SimpleFSArchiveCheckArchive(context.TODO(), zipFilePath)
		if err != nil {
			return err
		}

		ui.Printf("=== %s ===\n\n", zipFilePath)
		ui.Printf("Archive TLF Revision: %v%s\n",
			res.Desc.KbfsPathWithRevision.ArchivedParam.Revision(),
			revisionExtendedDescription(res.CurrentTLFRevision, &res.Desc))
		if len(res.PathsWithIssues) != 0 {
			ui.Printf("Some entries in the archive have problems:\n")
			for entryPath, entryIssue := range res.PathsWithIssues {
				ui.Printf("%s\n  - %s\n", entryPath, entryIssue)
			}
		} else {
			ui.Printf("Archive Integrity: OK\n")
		}
		ui.Printf("\n")
	}

	return nil
}

// ParseArgv parses the arguments.
func (c *CmdSimpleFSArchiveCheckArchive) ParseArgv(ctx *cli.Context) error {
	c.zipFilePaths = ctx.Args()
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSArchiveCheckArchive) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
