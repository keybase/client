package client

import (
	"fmt"
	"strings"
	"text/tabwriter"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type CmdTeamListRequests struct {
	libkb.Contextified
}

func newCmdTeamListRequests(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "list-requests",
		Usage: "list requests to join teams",
		Action: func(c *cli.Context) {
			cmd := NewCmdTeamListRequestsRunner(g)
			cl.ChooseCommand(cmd, "list-requests", c)
		},
	}
}

func NewCmdTeamListRequestsRunner(g *libkb.GlobalContext) *CmdTeamListRequests {
	return &CmdTeamListRequests{Contextified: libkb.NewContextified(g)}
}

func (c *CmdTeamListRequests) ParseArgv(ctx *cli.Context) error {
	return nil
}

func (c *CmdTeamListRequests) Run() error {
	cli, err := GetTeamsClient(c.G())
	if err != nil {
		return err
	}

	reqs, err := cli.TeamListRequests(context.Background(), 0)
	if err != nil {
		return err
	}

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
	dui.Printf("%s\n", strings.Repeat("-", 70))
	dui.Printf("To handle requests, use `keybase team add-member` or `keybase team ignore-request`.\n")

	return nil
}

func (c *CmdTeamListRequests) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
