// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const (
	defaultNumFSSearchResults = 10
)

// CmdSimpleFSSearch is the 'fs search' command.
type CmdSimpleFSSearch struct {
	libkb.Contextified

	query        string
	numResults   int
	startingFrom int
}

// NewCmdSimpleFSSearch creates a new cli.Command.
func NewCmdSimpleFSSearch(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "search",
		ArgumentHelp: "<query>",
		Usage:        "[disabled] search locally-synced folders",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSimpleFSSearch{
				Contextified: libkb.NewContextified(g)}, "search", c)
			cl.SetNoStandalone()
		},
		Flags: []cli.Flag{
			cli.IntFlag{
				Name:  "n, num-results",
				Usage: "how many results to return",
				Value: defaultNumFSSearchResults,
			},
			cli.IntFlag{
				Name:  "s, start-from",
				Usage: "what number result to start from (for paging)",
				Value: 0,
			},
		},
	}
}

// Run runs the command in client/server mode.
func (c *CmdSimpleFSSearch) Run() error {
	cli, err := GetSimpleFSClient(c.G())
	if err != nil {
		return err
	}

	arg := keybase1.SimpleFSSearchArg{
		Query:        c.query,
		NumResults:   c.numResults,
		StartingFrom: c.startingFrom,
	}
	res, err := cli.SimpleFSSearch(context.TODO(), arg)
	if err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()
	if len(res.Hits) == 0 {
		ui.Printf("No results\n")
		return nil
	}

	for _, hit := range res.Hits {
		ui.Printf("%s\n", hit.Path)
	}
	if res.NextResult != -1 {
		ui.Printf(
			"(For more results, use `--start-from %d` next time.)\n",
			res.NextResult)
	}
	return nil
}

// ParseArgv gets the optional flags and the query.
func (c *CmdSimpleFSSearch) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("wrong number of arguments")
	}

	c.query = ctx.Args().Get(0)
	c.numResults = ctx.Int("num-results")
	if c.numResults == 0 {
		c.numResults = defaultNumFSSearchResults
	}
	c.startingFrom = ctx.Int("start-from")

	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSimpleFSSearch) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		KbKeyring: true,
		API:       true,
	}
}
