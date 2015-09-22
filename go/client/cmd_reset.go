package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdReset struct{}

const (
	resetPrompt = "Really delete all local cached state?"
)

func (v *CmdReset) Run() (err error) {
	if err = GlobUI.PromptForConfirmation(resetPrompt); err != nil {
		return
	}

	cli, err := GetLoginClient()
	if err != nil {
		return err
	}

	protocols := []rpc2.Protocol{
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.Reset(0)
}

func NewCmdReset(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:  "reset",
		Usage: "Delete all local cached state",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdReset{}, "reset", c)
		},
	}
}

func (v *CmdReset) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

func (v *CmdReset) ParseArgv(*cli.Context) error { return nil }
