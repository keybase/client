// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"sort"
	"text/tabwriter"

	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

func NewCmdBlocks(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "blocks",
		Usage:        "Manage user and team blocks",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdBlocksListUser(cl, g),
		},
	}
}

// "keybase blocks list-user" command

type CmdBlocksListUser struct {
	libkb.Contextified
}

func NewCmdBlocksListUser(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdBlocksListUser{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:  "list-user",
		Usage: "Show blocked users.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "list-user", c)
		},
	}
}

func (c *CmdBlocksListUser) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdBlocksListUser) Run() (err error) {
	cli, err := GetUserClient(c.G())
	if err != nil {
		return err
	}

	blocks, err := cli.GetUserBlocks(context.Background(), keybase1.GetUserBlocksArg{})
	if err != nil {
		return err
	}

	tui := c.G().UI.GetTerminalUI()

	// See if we even have any active blocks first.
	var hasBlocks bool
	for _, v := range blocks {
		if v.ChatBlocked || v.FollowBlocked {
			hasBlocks = true
			break
		}
	}

	if !hasBlocks {
		tui.Printf("No one user is currently blocked by you.\n")
		return nil
	}

	sort.Slice(blocks, func(i, j int) bool {
		return blocks[i].Username < blocks[j].Username
	})

	// NOTE: tabwriter does not handle padding correctly when we emit escape
	// sequences for colours, so we do padding manually.

	colorfulYesNo := func(val bool) string {
		if val {
			// Red, angry, "yes-blocked".
			return ColorString(c.G(), "red", fmt.Sprintf("%-13s", "yes"))
		}
		// Green, cheerful, "not blocked".
		return ColorString(c.G(), "green", fmt.Sprintf("%-13s", "no"))
	}

	tabw := new(tabwriter.Writer)
	tabw.Init(tui.OutputWriter(), 5, 0, 3, ' ', 0)
	fmt.Fprintf(tabw, "Username:\tChat-blocked:    Follower-blocked:\n")
	for _, v := range blocks {
		if v.ChatBlocked || v.FollowBlocked {
			fmt.Fprintf(tabw, "%s\t%s    %s\n",
				v.Username,
				colorfulYesNo(v.ChatBlocked),
				colorfulYesNo(v.FollowBlocked),
			)
		}
	}
	tabw.Flush()
	return nil
}

func (c *CmdBlocksListUser) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
