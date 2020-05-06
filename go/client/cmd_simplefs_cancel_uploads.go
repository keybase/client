// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// CmdSimpleFSCancelUploads is the 'fs cancel-uploads' command.
type CmdSimpleFSCancelUploads struct {
	libkb.Contextified
	path   keybase1.KBFSPath
	filter keybase1.ListFilter
}

// NewCmdSimpleFSCancelUploads creates a new cli.Command.
func NewCmdSimpleFSCancelUploads(
	cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "cancel-uploads",
		ArgumentHelp: "[path-to-folder]",
		Usage:        "cancel all outstanding uploads in a folder",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSCancelUploads{
				Contextified: libkb.NewContextified(g)}, "cancel-uploads", c)
			cl.SetNoStandalone()
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name: "a, all",
				Usage: "display entries starting with '.' " +
					"(does not affect what is canceled)",
			},
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSCancelUploads) Run() error {
	prefix := mountDir + c.path.Path

	areUploads, err := printUploads(c.G(), c.filter, prefix)
	if err != nil {
		return err
	}
	ui := c.G().UI.GetTerminalUI()
	if !areUploads {
		ui.Printf("There are currently no uploads for %s", prefix)
		return nil
	}

	ui.Printf(
		"\nDo you really want to cancel the above uploads in progress for "+
			"%s?\n", prefix)
	ui.Printf("You may end up with partially-uploaded changes.\n")
	err = ui.PromptForConfirmation("Continue canceling the uploads?")
	if err != nil {
		return err
	}

	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}
	return cli.SimpleFSCancelJournalUploads(context.TODO(), c.path)
}

// ParseArgv gets the optional -a switch, and the path.
func (c *CmdSimpleFSCancelUploads) ParseArgv(ctx *cli.Context) error {
	if ctx.Bool("all") {
		c.filter = keybase1.ListFilter_NO_FILTER
	} else {
		c.filter = keybase1.ListFilter_FILTER_ALL_HIDDEN
	}

	if len(ctx.Args()) > 1 {
		return fmt.Errorf("wrong number of arguments")
	} else if len(ctx.Args()) == 1 {
		p, err := makeSimpleFSPath(ctx.Args()[0])
		if err != nil {
			return err
		}

		ty, err := p.PathType()
		if err != nil {
			return err
		}
		if ty != keybase1.PathType_KBFS {
			return errors.New("Must be a KBFS path")
		}

		// Make sure this is an exact TLF.
		s := strings.Split(p.String(), "/")
		if len(s) != 3 && (len(s) != 4 || s[3] != "") {
			return fmt.Errorf("Invalid folder path: %s", p.String())
		}

		c.path = p.Kbfs()
	}

	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSCancelUploads) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
