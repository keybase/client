package libkb

import (
	"fmt"
	"github.com/codegangsta/cli"
)

type CmdGetUser struct {
	input string
}

func (v *CmdGetUser) Initialize(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	if nargs == 1 {
		v.input = ctx.Args()[0]
	} else {
		err = fmt.Errorf("getuser takes one arg -- the user to load")
	}
	return err
}

func (v *CmdGetUser) Run() error {

	// XXX maybe do some sort of debug dump with the user that
	// we loaded from the server (or storage).
	_, err := LoadUser(LoadUserArg{
		name:             v.input,
		requirePublicKey: false,
		self:             false,
		loadSecrets:      false,
		forceReload:      false,
		skipVerify:       false,
	})
	if err != nil {
		return err
	}
	return nil
}

func (v *CmdGetUser) UseConfig() bool   { return true }
func (v *CmdGetUser) UseKeyring() bool  { return false }
func (v *CmdGetUser) UseAPI() bool      { return true }
func (v *CmdGetUser) UseTerminal() bool { return false }
