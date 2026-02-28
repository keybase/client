package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdKVStoreAPI struct {
	libkb.Contextified
	cmdAPI
}

func newCmdKVStoreAPI(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return newCmdAPI(cl, NewCmdKVStoreAPIRunner(g), "JSON API", kvStoreAPIDoc)
}

func NewCmdKVStoreAPIRunner(g *libkb.GlobalContext) *CmdKVStoreAPI {
	return &CmdKVStoreAPI{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdKVStoreAPI) Run() error {
	h := newKVStoreAPIHandler(c.G(), c.indent)
	return c.runHandler(h)
}
