package main

import (
	"fmt"

	"github.com/codegangsta/cli"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// CmdSibkeyAdd is the 'sibkey add' command.  It is used for
// device provisioning to enter a secret phrase on an existing
// device.
type CmdSibkeyAdd struct {
	phrase string
}

// NewCmdSibkeyAdd creates a new cli.Command.
func NewCmdSibkeyAdd(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "add",
		Usage:       "keybase sibkey add \"secret phrase\"",
		Description: "Add a new device sibkey",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdSibkeyAdd{}, "add", c)
		},
	}
}

// RunClient runs the command in client/server mode.
func (c *CmdSibkeyAdd) RunClient() error {
	cli, err := GetSibkeyClient()
	if err != nil {
		return err
	}
	protocols := []rpc2.Protocol{
		NewSecretUIProtocol(),
	}
	if err := RegisterProtocols(protocols); err != nil {
		return err
	}

	return cli.Add(c.phrase)
}

// Run runs the command in standalone mode.
func (c *CmdSibkeyAdd) Run() error {
	ctx := &engine.Context{SecretUI: G_UI.GetSecretUI()}
	eng := engine.NewKexSib(G, c.phrase)
	return engine.RunEngine(eng, ctx)
}

// ParseArgv gets the secret phrase from the command args.
func (c *CmdSibkeyAdd) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 1 {
		return fmt.Errorf("sibkey add takes one arg: the secret phrase")
	}
	c.phrase = ctx.Args()[0]
	return nil
}

// GetUsage says what this command needs to operate.
func (c *CmdSibkeyAdd) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  true,
		API:        true,
		Terminal:   true,
	}
}
