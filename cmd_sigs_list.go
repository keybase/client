package libkb

import (
	"fmt"
	"github.com/codegangsta/cli"
	"strings"
)

type CmdSigsList struct {
	filter string
	revoked bool
	json bool
	verbose bool
	types []string
}

func (s *CmdSigsList) ParseTypes(ctx *cli.Context) error {
	tmp := ctx.String("type")
	if len(tmp) == 0 {
		return nil
	}

	types := map[string]bool {
		"track" : true,
		"proof" : true,
		"cryptocurrency" : true,
		"self" : true,
	}

	ret := make([]string,0, 0)
	v := strings.Split(tmp, ",")
	for _,i := range(v) {
		ok, found := types[i]
		if !ok || !found {
			return fmt.Errorf("unknown signature type: %s", i)
		} else {
			ret = append(ret, i)
		}
	}
	s.types = ret
	return nil
}

func (s *CmdSigsList) Initialize(ctx *cli.Context) error {
	nargs := len(ctx.Args())
	var err error

	s.revoked = ctx.Bool("revoked")
	s.json = ctx.Bool("json")
	s.verbose = ctx.Bool("verbose")

	if err = s.ParseTypes(ctx); err != nil {
		return err
	}

	if nargs == 1 {
		s.filter = ctx.Args()[0]
	} else if nargs > 1{
		err = fmt.Errorf("list takes at most 1 arg, a filter")
	}

	return err
}

func (s *CmdSigsList) Run() error {

	// XXX maybe do some sort of debug dump with the user that
	// we loaded from the server (or storage).
	_, err := LoadUser(LoadUserArg{
		requirePublicKey: false,
		self:             true,
		loadSecrets:      false,
		forceReload:      false,
		skipVerify:       false,
	})
	if err != nil {
		return err
	}
	return nil
}

func (v *CmdSigsList) UseConfig() bool   { return true }
func (v *CmdSigsList) UseKeyring() bool  { return false }
func (v *CmdSigsList) UseAPI() bool      { return true }
func (v *CmdSigsList) UseTerminal() bool { return false }
