package client

import (
	"encoding/json"
	"fmt"
	"strings"
	"text/tabwriter"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdTeamListRequests struct {
	libkb.Contextified
	json bool
	team string
}

func newCmdTeamListRequests(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "list-requests",
		Usage: "List requests to join teams.",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamListRequestsRunner(g)
			cl.ChooseCommand(cmd, "list-requests", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "j, json",
				Usage: "Output requests as JSON",
			},
			cli.StringFlag{
				Name:  "t, team",
				Usage: "List request for specific team",
			},
		},
	}
}

func NewCmdTeamListRequestsRunner(g *libkb.GlobalContext) *CmdTeamListRequests {
	return &CmdTeamListRequests{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamListRequests) ParseArgv(ctx *cli.Context) error {
	c.json = ctx.Bool("json")
	c.team = ctx.String("team")
	return nil
}

func (c *CmdTeamListRequests) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}
	arg := keybase1.TeamListRequestsArg{}
	if c.team != "" {
		arg.TeamName = &c.team
	}
	reqs, err := cli.TeamListRequests(context.Background(), arg)
	if err != nil {
		return err
	}

	if c.json {
		return c.outputJSON(reqs)
	}

	return c.outputTerminal(reqs)

}

func (c *CmdTeamListRequests) outputJSON(reqs []keybase1.TeamJoinRequest) error {
	b, err := json.MarshalIndent(reqs, "", "    ")
	if err != nil {
		return err
	}
	dui := c.G().UI.GetDumbOutputUI()
	_, err = dui.Printf(string(b) + "\n")
	return err
}

func (c *CmdTeamListRequests) outputTerminal(reqs []keybase1.TeamJoinRequest) error {
	dui := c.G().UI.GetTerminalUI()
	if len(reqs) == 0 {
		dui.Printf("No requests at this time.\n")
		return nil
	}

	tabw := new(tabwriter.Writer)
	tabw.Init(dui.OutputWriter(), 0, 8, 2, ' ', 0)
	for _, req := range reqs {
		fmt.Fprintf(tabw, "%s\t%s wants to join\n", req.Name, req.Username)
	}
	tabw.Flush()

	werr := dui.ErrorWriter()
	fmt.Fprintf(werr, "%s\n", strings.Repeat("-", 70))
	fmt.Fprintf(werr, "To handle requests, use `keybase team add-member` or `keybase team ignore-request`.\n")

	return nil
}

func (c *CmdTeamListRequests) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
