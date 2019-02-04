package client

import (
	"errors"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
)

type CmdWalletCancelRequest struct {
	libkb.Contextified
	ID string
}

func newCmdWalletCancelRequest(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdWalletCancelRequest{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "cancel-request",
		Usage:        "Cancel payment request",
		ArgumentHelp: "<request id>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "cancel-request", c)
		},
	}
}

func (c *CmdWalletCancelRequest) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return errors.New("cancel-request needs request id as the argument")
	}

	c.ID = ctx.Args()[0]
	return nil
}

func (c *CmdWalletCancelRequest) Run() (err error) {
	defer transformStellarCLIError(&err)
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	requestID, err := stellar1.KeybaseRequestIDFromString(c.ID)
	if err != nil {
		return err
	}

	return cli.CancelRequestLocal(context.Background(), stellar1.CancelRequestLocalArg{
		ReqID: requestID,
	})
}

func (c *CmdWalletCancelRequest) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
