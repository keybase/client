// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

func NewCmdAudit(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	commands := []cli.Command{
		NewCmdAuditBox(cl, g),
	}

	return cli.Command{
		Name: "audit",
		// No 'Usage' makes this hidden
		Description: "Perform security audits",
		Subcommands: commands,
	}
}

type CmdAuditBox struct {
	libkb.Contextified
	AuditAllKnownTeams  bool
	IsInJail            bool
	Audit               bool
	Attempt             bool
	RotateBeforeAttempt bool
	Ls                  bool
	TeamID              keybase1.TeamID
	TeamName            string
}

func NewCmdAuditBox(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdAuditBox{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name: "box",
		Usage: `A team box audit makes sure a team's secrets are encrypted for
	the right members in the team, and that when members revoke devices or
	reset their accounts, the team's secret keys are rotated accordingly.`,
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name: "audit-all-known-teams",
				Usage: `Audit all known teams. If an audit fails, the team will
	be rotated and the audit will be retried immediately . If it fails again,
	this error will be reported. This operation may take a long time if you are
	in many teams.`,
			},
			cli.StringFlag{
				Name:  "team-id",
				Usage: "Team ID, required (or team name) except for list-known-team-ids/audit-all-known-teams",
			},
			cli.StringFlag{
				Name:  "team",
				Usage: "Team name, required (or team ID) except for list-known-team-ids/audit-all-known-teams",
			},
			cli.BoolFlag{
				Name:  "is-in-jail",
				Usage: "Check if a team id is in the box audit jail",
			},
			cli.BoolFlag{
				Name:  "audit",
				Usage: "Audit a team id, storing result to disk and scheduling additional background reaudits if it failed",
			},
			cli.BoolFlag{
				Name:  "attempt",
				Usage: "Audit a team id without persisting results anywhere",
			},
			cli.BoolFlag{
				Name:  "rotate-before-attempt",
				Usage: "Only valid with --attempt; rotate the team's keys first when given.",
			},
			cli.BoolFlag{
				Name:  "list-known-team-ids",
				Usage: "List all known team ids",
			},
		},
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "box", c)
		},
	}
}

func b2i(x bool) int {
	if x {
		return 1
	}
	return 0
}

func (c *CmdAuditBox) ParseArgv(ctx *cli.Context) error {
	c.AuditAllKnownTeams = ctx.Bool("audit-all-known-teams")
	c.IsInJail = ctx.Bool("is-in-jail")
	c.Audit = ctx.Bool("audit")
	c.Attempt = ctx.Bool("attempt")
	c.Ls = ctx.Bool("list-known-team-ids")
	if b2i(c.AuditAllKnownTeams)+b2i(c.IsInJail)+b2i(c.Audit)+b2i(c.Attempt)+b2i(c.Ls) != 1 {
		return fmt.Errorf("need a single command: audit-all-known-teams, is-in-jail, audit, attempt, or list-known-team-ids")
	}
	c.RotateBeforeAttempt = ctx.Bool("rotate-before-attempt")
	if c.RotateBeforeAttempt && !c.Attempt {
		return fmt.Errorf("can only use --rotate-before-attempt with --attempt")
	}

	c.TeamID = keybase1.TeamID(ctx.String("team-id"))
	c.TeamName = ctx.String("team")
	if len(c.TeamID) != 0 && len(c.TeamName) != 0 {
		return fmt.Errorf("cannot provide both team id and team name")
	}
	gaveTeam := c.TeamID != "" || c.TeamName != ""

	if c.Ls || c.AuditAllKnownTeams {
		if gaveTeam {
			return fmt.Errorf("cannot provide team with this option")
		}
	} else {
		if !gaveTeam {
			return fmt.Errorf("need team id or team name")
		}
	}

	return nil
}

type AuditResult struct {
	teamID keybase1.TeamID
	err    error
}

func (c *CmdAuditBox) Run() error {
	cli, err := GetAuditClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.Background()

	if c.TeamName != "" {
		cli, err := GetTeamsClient(c.G())
		if err != nil {
			return err
		}
		teamID, err := cli.GetTeamID(ctx, c.TeamName)
		if err != nil {
			return err
		}
		c.TeamID = teamID
	}

	var failedTeamIDs []keybase1.TeamID
	switch {
	case c.AuditAllKnownTeams:
		knownTeamIDs, err := cli.KnownTeamIDs(ctx, 0)
		if err != nil {
			return err
		}

		// team name, 1/...
		for idx, teamID := range knownTeamIDs {
			arg := keybase1.BoxAuditTeamArg{TeamID: teamID}

			var err error
			var attempt *keybase1.BoxAuditAttempt
			attempt, err = cli.BoxAuditTeam(ctx, arg)
			prefix := fmt.Sprintf("(%d/%d) %s", idx+1, len(knownTeamIDs), teamID)
			describeAttempt(c.G(), attempt, prefix)
			if err != nil {
				attempt, err = cli.BoxAuditTeam(ctx, arg)
				describeAttempt(c.G(), attempt, "(retry) "+prefix)
			}
			if err != nil {
				c.G().Log.Error("Audit failed for %s: %s", teamID, err)
				failedTeamIDs = append(failedTeamIDs, teamID)
			}
		}

		if failedTeamIDs != nil {
			var teamIDStrs []string
			for _, teamID := range failedTeamIDs {
				teamIDStrs = append(teamIDStrs, teamID.String())
			}
			return fmt.Errorf("The following teams failed to pass an audit. This does not necessarily mean something is wrong, unless you are a member of those teams.\n%s", strings.Join(teamIDStrs, ", "))
		}
		return nil
	case c.IsInJail:
		ok, err := cli.IsInJail(ctx, keybase1.IsInJailArg{TeamID: c.TeamID})
		if err != nil {
			return err
		}
		fmt.Println(ok)
		return nil
	case c.Audit:
		attempt, err := cli.BoxAuditTeam(ctx, keybase1.BoxAuditTeamArg{TeamID: c.TeamID})
		describeAttempt(c.G(), attempt, "")
		return err
	case c.Attempt:
		arg := keybase1.AttemptBoxAuditArg{TeamID: c.TeamID, RotateBeforeAudit: c.RotateBeforeAttempt}
		audit, err := cli.AttemptBoxAudit(ctx, arg)
		if err != nil {
			return err
		}
		fmt.Printf("%s\n", audit.Ctime.Time())
		fmt.Printf("Result: %s\n", audit.Result)
		if audit.Generation != nil {
			fmt.Printf("Team generation: %d\n", *audit.Generation)
		}
		if audit.Error != nil {
			c.G().Log.Error("Box audit attempt failed: %s\n", *audit.Error)
		}
		return nil
	case c.Ls:
		ids, err := cli.KnownTeamIDs(ctx, 0)
		if err != nil {
			return err
		}
		for _, id := range ids {
			fmt.Println(id)
		}
		return nil
	default:
		return fmt.Errorf("no command given")
	}
}

func (c *CmdAuditBox) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func describeAttempt(g *libkb.GlobalContext, attempt *keybase1.BoxAuditAttempt, info string) {
	tui := g.UI.GetTerminalUI()
	prefix := ""
	if info != "" {
		prefix = info + " "
	}
	if attempt == nil {
		tui.PrintfUnescaped("%s\n", ColorString(g, "red", prefix+"Audit not attempted."))
	} else if attempt.Error == nil {
		tui.PrintfUnescaped("%s\n", ColorString(g, "green", prefix+attempt.String()))
	} else {
		tui.PrintfUnescaped("%s\n", ColorString(g, "red", prefix+attempt.String()))
	}
}
