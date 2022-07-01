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
			NewCmdBlocksListUsers(cl, g),
			NewCmdBlocksListTeams(cl, g),
		},
	}
}

// "keybase blocks list-users" command

type CmdBlocksListUsers struct {
	libkb.Contextified
}

func NewCmdBlocksListUsers(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdBlocksListUsers{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:  "list-users",
		Usage: "Show blocked users.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "list-users", c)
		},
	}
}

func (c *CmdBlocksListUsers) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdBlocksListUsers) Run() (err error) {
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
		tui.Printf("You haven't blocked anyone yet.\n")
		return nil
	}

	sort.Slice(blocks, func(i, j int) bool {
		return blocks[i].Username < blocks[j].Username
	})

	yesNoFmt := func(val bool) string {
		if val {
			return "yes"
		}
		return "no"
	}

	timeFmt := func(vals ...*keybase1.Time) string {
		for _, val := range vals {
			if val != nil {
				return keybase1.FromTime(*val).Format("2006-01-02 15:04 MST")
			}
		}
		return ""
	}

	tabw := new(tabwriter.Writer)
	tabw.Init(tui.OutputWriter(), 5, 0, 3, ' ', 0)
	fmt.Fprintf(tabw, "Username:\tChat-blocked:\tFollower-blocked:\tTime:\n")
	for _, v := range blocks {
		if v.ChatBlocked || v.FollowBlocked {
			fmt.Fprintf(tabw, "%s\t%s\t%s\t%s\n",
				v.Username,
				yesNoFmt(v.ChatBlocked),
				yesNoFmt(v.FollowBlocked),
				timeFmt(v.ModifyTime, v.CreateTime),
			)
		}
	}
	tabw.Flush()
	return nil
}

func (c *CmdBlocksListUsers) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

// "keybase blocks list-teams" command

type CmdBlocksListTeams struct {
	libkb.Contextified
}

func NewCmdBlocksListTeams(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdBlocksListTeams{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:  "list-teams",
		Usage: "Show blocked teams.",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "list-teams", c)
		},
	}
}

func (c *CmdBlocksListTeams) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdBlocksListTeams) Run() (err error) {
	cli, err := GetUserClient(c.G())
	if err != nil {
		return err
	}

	blocks, err := cli.GetTeamBlocks(context.Background(), 0)
	if err != nil {
		return err
	}

	tui := c.G().UI.GetTerminalUI()

	if len(blocks) == 0 {
		tui.Printf("You haven't blocked any teams yet.\n")
		return nil
	}

	sort.Slice(blocks, func(i, j int) bool {
		return blocks[i].TeamName < blocks[j].TeamName
	})

	tabw := new(tabwriter.Writer)
	tabw.Init(tui.OutputWriter(), 5, 0, 3, ' ', 0)
	fmt.Fprintf(tabw, "Team name:\tBlocked at:\n")
	for _, v := range blocks {
		fmt.Fprintf(tabw, "%s\t%s\n",
			v.TeamName,
			keybase1.FromTime(v.CreateTime).Format("2006-01-02 15:04 MST"),
		)
	}
	tabw.Flush()
	return nil
}

func (c *CmdBlocksListTeams) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
