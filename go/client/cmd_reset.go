package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CmdReset struct{}

const (
	resetPrompt = "Really delete all local cached state?"
)

func (v *CmdReset) RunClient() (err error) {
	if err = G_UI.PromptForConfirmation(resetPrompt); err != nil {
		return
	}

	cli, err := GetLoginClient()
	if err != nil {
		return err
	}

	protocols := []rpc2.Protocol{
		NewLogUIProtocol(),
	}
	if err = RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.Reset()
}

func (v *CmdReset) Run() (err error) {
	if err = G_UI.PromptForConfirmation(resetPrompt); err != nil {
		return
	}

	eng := engine.NewResetEngine()
	ctx := engine.Context{}
	return engine.RunEngine(eng, &ctx)
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

func (c *CmdReset) ParseArgv(*cli.Context) error { return nil }
