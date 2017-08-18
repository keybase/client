// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// CmdListTrackers is the 'list-trackers' command.  It displays
// all the trackers for a user.
type CmdListTrackers struct {
	libkb.Contextified
	assertion string
	verbose   bool
	json      bool
	headers   bool
}

// NewCmdListTrackers creates a new cli.Command.
func NewCmdListTrackers(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "list-followers",
		ArgumentHelp: "<username>",
		Usage:        "List those who follow you",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "v, verbose",
				Usage: "A full dump, with more gory details.",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdListTrackers{Contextified: libkb.NewContextified(g)}, "list-followers", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdListTrackers) Run() error {
	cli, err := GetUserClient(c.G())
	if err != nil {
		return err
	}
	if err := RegisterProtocols(nil); err != nil {
		return err
	}

	arg := keybase1.ListTrackers2Arg{
		Assertion: c.assertion,
		Reverse:   false,
	}
	uss, err := cli.ListTrackers2(context.TODO(), arg)
	if err != nil {
		return err
	}
	return c.output(uss)
}

func (c *CmdListTrackers) output(uss keybase1.UserSummary2Set) (err error) {

	if len(uss.Users) == 0 {
		GlobUI.Printf("no followers\n")
		return nil
	}
	dui := c.G().UI.GetDumbOutputUI()

	for _, user := range uss.Users {
		dui.Printf("%s", user.Username)
		if c.verbose {
			dui.Printf("\t%s", user.FullName)
		}
		dui.Printf("\n")
	}
	return nil
}

// ParseArgv parses the command args.
func (c *CmdListTrackers) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) == 1 {
		c.assertion = ctx.Args()[0]
	}

	c.verbose = ctx.Bool("verbose")
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdListTrackers) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
