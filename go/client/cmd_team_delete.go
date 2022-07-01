package client

import (
	"fmt"
	"sort"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdTeamDelete struct {
	libkb.Contextified
	Team keybase1.TeamName
}

func newCmdTeamDelete(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "delete",
		ArgumentHelp: "<team name>",
		Usage:        "Delete a team.",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamDeleteRunner(g)
			cl.ChooseCommand(cmd, "delete", c)
		},
	}
}

func NewCmdTeamDeleteRunner(g *libkb.GlobalContext) *CmdTeamDelete {
	return &CmdTeamDelete{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamDelete) ParseArgv(ctx *cli.Context) error {
	var err error
	c.Team, err = ParseOneTeamNameK1(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (c *CmdTeamDelete) Run() error {
	protocols := []rpc.Protocol{
		NewTeamsUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	teamID, err := cli.GetTeamID(context.Background(), c.Team.String())
	if err != nil {
		return err
	}

	arg := keybase1.TeamDeleteArg{
		TeamID: teamID,
	}

	dui := c.G().UI.GetTerminalUI()

	subteams := c.listSubteamsRecursiveSoft(&cli)

	if len(subteams) > 0 {
		c.showSubteamsMessage(subteams)
		return fmt.Errorf("team has active subteams")
	}

	err = cli.TeamDelete(context.Background(), arg)
	if err != nil {
		if libkb.IsAppStatusCode(err, keybase1.StatusCode_SCTeamHasLiveChildren) {
			subteams = c.listSubteamsRecursiveSoft(&cli)
			c.showSubteamsMessage(subteams)
		}
		return err
	}

	dui.Printf("Success! Team %s deleted.\n", c.Team)

	return nil
}

func (c *CmdTeamDelete) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

func (c *CmdTeamDelete) listSubteamsRecursiveSoft(cli *keybase1.TeamsClient) []keybase1.TeamName {
	res, err := c.listSubteamsRecursive(cli)
	if err != nil {
		c.G().Log.CDebugf(context.TODO(), "error getting subteams: %v", err)
		return nil
	}
	return res
}

// List the subteams of c.Team
func (c *CmdTeamDelete) listSubteamsRecursive(cli *keybase1.TeamsClient) (res []keybase1.TeamName, err error) {
	subs, err := cli.TeamListSubteamsRecursive(context.TODO(), keybase1.TeamListSubteamsRecursiveArg{
		ParentTeamName: c.Team.String(),
		ForceRepoll:    true,
	})
	if err != nil {
		return res, err
	}
	// Sort the response alphabetically
	sort.Slice(subs, func(i, j int) bool {
		return subs[i].Name.String() < subs[j].Name.String()
	})
	for _, sub := range subs {
		res = append(res, sub.Name)
	}
	return res, err
}

func (c *CmdTeamDelete) showSubteamsMessage(subteams []keybase1.TeamName) {
	dui := c.G().UI.GetTerminalUI()
	dui.Printf("\nCannot delete team %s because it has active subteams.\n", c.Team)
	if len(subteams) == 0 {
		dui.Printf("Delete all of its subteams first.\n")
	} else {
		dui.Printf("Delete all of its subteams first:\n")
		for _, subteam := range subteams {
			dui.Printf("- %s\n", subteam)
		}
	}
	dui.Printf("\n")
}
