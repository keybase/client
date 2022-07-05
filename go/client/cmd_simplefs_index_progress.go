// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"fmt"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSIndexProgress is the 'fs index-progress' command.
type CmdSimpleFSIndexProgress struct {
	libkb.Contextified
}

// NewCmdSimpleFSIndexProgress creates a new cli.Command.
func NewCmdSimpleFSIndexProgress(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "index-progress",
		Usage: "[disabled] print the current progress of the indexer",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSIndexProgress{
				Contextified: libkb.NewContextified(g)}, "index-progress", c)
			cl.SetNoStandalone()
		},
	}
}

func printIndexProgress(
	ui libkb.TerminalUI, p keybase1.IndexProgressRecord) {
	ui.Printf("\t%s/%s (%.2f%%)\n",
		humanizeBytes(p.BytesSoFar, false),
		humanizeBytes(p.BytesTotal, false),
		100*float64(p.BytesSoFar)/float64(p.BytesTotal))

	if p.EndEstimate > 0 {
		timeRemaining := time.Until(keybase1.FromTime(p.EndEstimate))
		ui.Printf("\tEstimated time remaining: %s\n",
			timeRemaining.Round(1*time.Second))
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSIndexProgress) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	p, err := cli.SimpleFSGetIndexProgress(context.TODO())
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	if p.OverallProgress.BytesTotal == 0 {
		ui.Printf("No indexing in progress\n")
		return nil
	}

	ui.Printf("Overall index progress:\n")
	printIndexProgress(ui, p.OverallProgress)
	if p.CurrFolder.Name != "" {
		ui.Printf("\nCurrent index progress (%s):\n", p.CurrFolder)
		printIndexProgress(ui, p.CurrProgress)
	}

	if len(p.FoldersLeft) > 0 {
		ui.Printf("\nFolders waiting to be indexed:\n")
		for _, f := range p.FoldersLeft {
			ui.Printf("\t%s\n", f)
		}
	}
	return nil
}

// ParseArgv gets the optional flags and the query.
func (c *CmdSimpleFSIndexProgress) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return fmt.Errorf("wrong number of arguments")
	}

	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSIndexProgress) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
