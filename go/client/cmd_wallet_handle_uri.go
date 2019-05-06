package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

type CmdWalletHandleURI struct {
	libkb.Contextified
	uri string
}

func newCmdWalletHandleURI(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdWalletHandleURI{
		Contextified: libkb.NewContextified(g),
	}

	return cli.Command{
		Name:         "handle-uri",
		Usage:        "Handle a 'web+stellar:' URI manually",
		ArgumentHelp: "<uri>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "handle-uri", c)
		},
	}
}

func (c *CmdWalletHandleURI) ParseArgv(ctx *cli.Context) error {
	c.uri = ctx.Args().First()
	if c.uri == "" {
		return errors.New("uri required")
	}

	return nil
}

func (c *CmdWalletHandleURI) Run() (err error) {
	defer transformStellarCLIError(&err)

	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	protocols := []rpc.Protocol{
		NewIdentifyUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	ui := c.G().UI.GetTerminalUI()

	ui.Printf(ColorString(c.G(), "yellow", "Validating URI...\n"))
	arg := stellar1.ValidateStellarURILocalArg{
		InputURI: c.uri,
	}
	_, err = cli.ValidateStellarURILocal(context.Background(), arg)
	if err != nil {
		return err
	}

	ui.Printf(ColorString(c.G(), "green", "URI validated.\n"))

	return nil
}

func (c *CmdWalletHandleURI) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
