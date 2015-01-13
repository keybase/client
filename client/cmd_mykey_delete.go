package main

import (
	"github.com/codegangsta/cli"
	"github.com/keybase/go/libcmdline"
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
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

func (v *MykeyDeleteClient) Run() (err error) {
	return
}

func (v *CmdMykeyDelete) Run() (err error) {
	v.eng = MykeyDeleteStandlone{}
	return v.run()
}

func (v *CmdMykeyDelete) run() (err error) {
	return
}

func (v MykeyDeleteStandlone) Run() (err error) {
	return libkb.DeletePrimary()
}

type MykeyDeleteStandlone struct{}
type MykeyDeleteClient struct {
	cli keybase_1.MykeyClient
}

type MykeyDeleteEngine interface {
	Run() error
}

type CmdMykeyDelete struct {
	eng   MykeyDeleteEngine
	force bool
}

func (d *CmdMykeyDelete) ParseArgv(ctx *cli.Context) (err error) {
	nargs := len(ctx.Args())
	d.force = ctx.Bool("force")
	if nargs != 0 {
		err = BadArgsError{"delete doesn't take arguments"}
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
