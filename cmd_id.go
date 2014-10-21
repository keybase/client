package libkb

import (
	"fmt"
	"github.com/codegangsta/cli"
)

type CmdId struct {
	user string
	assertion string
}

func (v *CmdId) Initialize(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	if nargs == 1 {
		v.user = ctx.Args()[0]
	} else {
		err = fmt.Errorf("id takes one arg -- the user to lookup")
	}
	return err
}

func (v *CmdId) Run() error {
	return nil
}

func (v *CmdId) UseConfig() bool   { return true }
func (v *CmdId) UseKeyring() bool  { return true }
func (v *CmdId) UseAPI() bool      { return true }
func (v *CmdId) UseTerminal() bool { return true }
