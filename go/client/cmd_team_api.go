package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdTeamAPI struct {
	libkb.Contextified
	cmdAPI
}

func newCmdTeamAPI(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return newCmdAPI(cl, NewCmdTeamAPIRunner(g), "JSON API", teamAPIDoc)
}

func NewCmdTeamAPIRunner(g *libkb.GlobalContext) *CmdTeamAPI {
	return &CmdTeamAPI{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdTeamAPI) Run() error {
	h := newTeamAPIHandler(c.G(), c.indent)
	return c.runHandler(h)
}
