// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

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
				Usage: "Team ID, required for all operations except list-known-team-ids",
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
	if c.Ls || c.AuditAllKnownTeams {
		if len(c.TeamID) != 0 {
			return fmt.Errorf("cannot provide team id with this option")
		}
	} else {
		if len(c.TeamID) == 0 {
			return fmt.Errorf("need team id")
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

	switch {
	case c.AuditAllKnownTeams:
		knownTeamIDs, err := cli.KnownTeamIDs(context.Background(), 0)
		if err != nil {
			return err
		}
		var auditResults []AuditResult
		for _, teamID := range knownTeamIDs {
			c.G().Log.Info("Auditing team %s...", teamID)
			arg := keybase1.BoxAuditTeamArg{TeamID: teamID}
			var err error
			for idx := 0; idx < 2; idx++ {
				// If the previous one failed, it will be in the retry queue
				// and hence, this retry will rotate before attempt
				// automatically.
				err = cli.BoxAuditTeam(context.Background(), arg)
				if err == nil {
					break
				}
			}
			auditResults = append(auditResults, AuditResult{
				teamID: teamID,
				err:    err,
			})
		}

		ok := true
		for _, auditResult := range auditResults {
			var description string
			if auditResult.err == nil {
				description = "OK"
			} else {
				ok = false
				description = fmt.Sprintf("ERROR %s", auditResult.err)
			}
			fmt.Printf("%s %s\n", auditResult.teamID, description)
		}
		if !ok {
			return fmt.Errorf("Some teams failed to pass an audit. This does not necessarily mean something is wrong, unless you are a member of those teams.")
		}
		return nil
	case c.IsInJail:
		ok, err := cli.IsInJail(context.Background(), keybase1.IsInJailArg{TeamID: c.TeamID})
		if err != nil {
			return err
		}
		fmt.Println(ok)
		return nil
	case c.Audit:
		err := cli.BoxAuditTeam(context.Background(), keybase1.BoxAuditTeamArg{TeamID: c.TeamID})
		if err != nil {
			return err
		}
		return nil
	case c.Attempt:
		arg := keybase1.AttemptBoxAuditArg{TeamID: c.TeamID, RotateBeforeAudit: c.RotateBeforeAttempt}
		audit, err := cli.AttemptBoxAudit(context.Background(), arg)
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
		ids, err := cli.KnownTeamIDs(context.Background(), 0)
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
