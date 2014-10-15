package libkb

import (
	"github.com/codegangsta/cli"
)

type CmdDbNuke struct {
	ctx *cli.Context
}

func (c *CmdDbNuke) Run() error {
	var err error
	force := c.ctx.Bool("force")
	if !force {
		err = PromptForConfirmation("Really blast away your local DB cache?")
	}
	if err == nil {
		err = G.LocalDb.Nuke()
	}
	return err
}

func (v *CmdDbNuke) UseConfig() bool   { return true }
func (v *CmdDbNuke) UseKeyring() bool  { return false }
func (v *CmdDbNuke) UseAPI() bool      { return false }
func (v *CmdDbNuke) UseTerminal() bool { return true }
func (c *CmdDbNuke) Initialize(*cli.Context) error { return nil }
