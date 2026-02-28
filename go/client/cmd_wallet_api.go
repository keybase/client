package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type CmdWalletAPI struct {
	libkb.Contextified
	cmdAPI
}

func newCmdWalletAPI(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return newCmdAPI(cl, NewCmdWalletAPIRunner(g), "JSON API", walletAPIDoc)
}

func NewCmdWalletAPIRunner(g *libkb.GlobalContext) *CmdWalletAPI {
	return &CmdWalletAPI{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdWalletAPI) Run() error {
	h := newWalletAPIHandler(c.G(), c.indent)
	return c.runHandler(h)
}
