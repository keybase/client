package libkb

import (
	"fmt"
	"github.com/codegangsta/cli"
)

type CmdResolve struct {
	input string
}

func (v *CmdResolve) Initialize(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	if nargs == 1 {
		v.input = ctx.Args()[0]
	} else {
		err = fmt.Errorf("resolve takes one arg -- the name to resolve")
	}
	return err
}

func (v *CmdResolve) Run() error {
	res, err := ResolveUsername(v.input)
	if err == nil {
		fmt.Println(res)
	}
	return err
}

func (v *CmdResolve) UseConfig() bool   { return true }
func (v *CmdResolve) UseKeyring() bool  { return false }
func (v *CmdResolve) UseAPI() bool      { return true }
func (v *CmdResolve) UseTerminal() bool { return false }
