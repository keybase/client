package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdAccountContactSettingsAPI struct {
	libkb.Contextified
	cmdAPI
}

func newCmdAccountContactSettingsAPI(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return newCmdAPI(cl, NewCmdAccountContactSettingsAPIRunner(g), "JSON API", contactSettingsAPIDoc)
}

func NewCmdAccountContactSettingsAPIRunner(g *libkb.GlobalContext) *CmdAccountContactSettingsAPI {
	return &CmdAccountContactSettingsAPI{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdAccountContactSettingsAPI) Run() error {
	h := newContactSettingsAPIHandler(c.G(), c.indent)
	return c.runHandler(h)
}
