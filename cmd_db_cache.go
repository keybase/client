package libkb

import (
	"fmt"
	"github.com/codegangsta/cli"
)

type CmdDbCache struct {
	input string
}

func (v *CmdDbCache) Initialize(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error
	if nargs == 1 {
		v.input = ctx.Args()[0]
	} else {
		err = fmt.Errorf("getuser takes one arg -- the user to load")
	}
	return err
}

func (v *CmdDbCache) Run() error {

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

func (v *CmdDbCache) UseConfig() bool   { return true }
func (v *CmdDbCache) UseKeyring() bool  { return false }
func (v *CmdDbCache) UseAPI() bool      { return true }
func (v *CmdDbCache) UseTerminal() bool { return false }
