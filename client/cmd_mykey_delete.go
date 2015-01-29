package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go/Godeps/_workspace/src/github.com/keybase/protocol/go"
	"github.com/keybase/go/libcmdline"
	"github.com/keybase/go/libkb"
)

func (v *CmdMykeyDelete) RunClient() (err error) {
	eng := &MykeyDeleteClient{}
	if err = eng.Init(); err != nil {
		return
	}
	v.eng = eng
	err = v.run()
	return
}

func (v *MykeyDeleteClient) Init() (err error) {
	v.cli, err = GetMykeyClient()
	return
}

func (v *MykeyDeleteClient) run() (err error) {
	return v.cli.DeletePrimary()
}

func (v *CmdMykeyDelete) Run() (err error) {
	v.eng = MykeyDeleteStandlone{}
	return v.run()
}

func (v *CmdMykeyDelete) PromptForConfirmation() (err error) {
	G.Log.Error(ColorString("bold", "DANGER ZONE") + ": Really delete your primary key and all of your proofs?")
	return G_UI.PromptForConfirmation("Go ahead?")
}

func (v *CmdMykeyDelete) run() (err error) {
	if !v.force {
		if err = v.PromptForConfirmation(); err != nil {
			return
		}
	}
	return v.eng.run()
}

func (v MykeyDeleteStandlone) run() (err error) {
	return libkb.DeletePrimary()
}

type MykeyDeleteStandlone struct{}
type MykeyDeleteClient struct {
	cli keybase_1.MykeyClient
}

type MykeyDeleteEngine interface {
	run() error
}

type CmdMykeyDelete struct {
	eng   MykeyDeleteEngine
	force bool
}

func (d *CmdMykeyDelete) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	d.force = ctx.Bool("force")
	if nargs != 0 {
		err = BadArgsError("delete doesn't take arguments")
	}
	return err
}

func NewCmdMykeyDelete(cl *libcmdline.CommandLine) cli.Command {
	return cli.Command{
		Name:        "delete",
		Usage:       "keybase mykey delete",
		Description: "Delete your primary public key from keybase and start from scratch",
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "force",
				Usage: "Don't prompt, just force",
			},
		},
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdMykeyDelete{}, "delete", c)
		},
	}
}

func (v *CmdMykeyDelete) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:     true,
		GpgKeyring: false,
		KbKeyring:  true,
		API:        true,
		Terminal:   true,
	}
}
