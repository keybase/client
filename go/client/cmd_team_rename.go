// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdTeamRename struct {
	PrevName  keybase1.TeamName
	NewName   keybase1.TeamName
	SessionID int
	libkb.Contextified
}

func (v *CmdTeamRename) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 2 {
		return errors.New("two team names required")
	}

	v.PrevName, err = keybase1.TeamNameFromString(ctx.Args()[0])
	if err != nil {
		return fmt.Errorf("invalid old team name: %v", err)
	}

	v.NewName, err = keybase1.TeamNameFromString(ctx.Args()[1])
	if err != nil {
		return fmt.Errorf("invalid new team name: %v", err)
	}

	return nil
}

// Most of the checks are in the teams package.
// This just covers this one presentation thing:
//
// > keybase team change-name aviato.usa.marketing aviato.america.sales
// Error! You must first rename `aviato.usa` to `aviato.america`.
func (v *CmdTeamRename) helpRenameWrongLevel() (err error) {
	if v.PrevName.Depth() != v.NewName.Depth() {
		return nil
	}
	if v.PrevName.Depth() < 3 {
		return nil
	}
	// Scan the parts of both names looking for the first difference.
	// Skip the root and the end. Because the root is not this case,
	// and the end is not a problem.
	// If it is in the middle then tell the user what to do.
	for i := 1; i < len(v.PrevName.Parts)-1; i++ {
		prevPart := v.PrevName.Parts[i]
		newPart := v.NewName.Parts[i]
		if !prevPart.Eq(newPart) {
			a1 := keybase1.TeamName{Parts: v.PrevName.Parts[:i+1]}
			a2 := keybase1.TeamName{Parts: v.NewName.Parts[:i+1]}
			return fmt.Errorf("You must first rename `%v` to `%v`", a1, a2)
		}
	}
	return nil
}

func (v *CmdTeamRename) Run() (err error) {
	cli, err := GetTeamsClient(v.G())
	if err != nil {
		return err
	}

	err = v.helpRenameWrongLevel()
	if err != nil {
		return err
	}

	return cli.TeamRename(context.TODO(), keybase1.TeamRenameArg{
		PrevName:  v.PrevName,
		NewName:   v.NewName,
		SessionID: v.SessionID,
	})
}

func newCmdTeamRename(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "rename",
		ArgumentHelp: "<team name> <new name>",
		Usage:        "Change the name of a subteam.",
		Flags:        []cli.Flag{},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdTeamRenameRunner(g), "teamrename", c)
		},
		Description: "Rename a subteam.",
	}
}

func NewCmdTeamRenameRunner(g *libkb.GlobalContext) *CmdTeamRename {
	return &CmdTeamRename{Contextified: libkb.NewContextified(g)}
}

func (v *CmdTeamRename) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
