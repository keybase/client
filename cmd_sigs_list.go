package libkb

import (
	"fmt"
	"github.com/codegangsta/cli"
	"regexp"
	"strings"
	"text/tabwriter"
)

type CmdSigsList struct {
	filter  string
	revoked bool
	json    bool
	verbose bool
	types   map[string]bool

	user *User
	sigs []TypedChainLink
}

func (s *CmdSigsList) ParseTypes(ctx *cli.Context) error {
	tmp := ctx.String("type")
	if len(tmp) == 0 {
		return nil
	}

	types := map[string]bool{
		"track":          true,
		"proof":          true,
		"cryptocurrency": true,
		"self":           true,
	}

	ret := make(map[string]bool)
	v := strings.Split(tmp, ",")
	for _, i := range v {
		ok, found := types[i]
		if !ok || !found {
			return fmt.Errorf("unknown signature type: %s", i)
		} else {
			ret[i] = true
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
	} else if nargs > 1 {
		err = fmt.Errorf("list takes at most 1 arg, a filter")
	}

	return err
}

func (s *CmdSigsList) filterSigs(f func(TypedChainLink) bool) {
	sigs := make([]TypedChainLink, 0, 0)
	for _, link := range s.sigs {
		if f(link) {
			sigs = append(sigs, link)
		}
	}
	s.sigs = sigs
}

func (s *CmdSigsList) SelectSigs() error {
	s.sigs = s.user.idTable.order
	if s.types != nil {
		s.filterSigs(func(l TypedChainLink) bool {
			ok, found := s.types[l.Type()]
			return ok && found
		})
	}
	return nil
}

func (s *CmdSigsList) FilterRxx() error {
	rxx, err := regexp.Compile(s.filter)
	if err != nil {
		return err
	}
	return nil
}

func (s *CmdSigsList) ProcessSigs() (err error) {
	if err = s.SelectSigs(); err != nil {
		return
	}
	if err = s.FilterRxx(); err != nil {
		return
	}
	return
}

func (s *CmdSigsList) DisplayTable() (err error) {
	return
}

func (s *CmdSigsList) DisplayJson() (err error) {
	return
}

func (s *CmdSigsList) Display() (err error) {
	if s.json {
		err = s.DisplayJson()
	} else {
		err = s.DisplayTable()
	}
	return
}

func (s *CmdSigsList) Run() (err error) {

	// XXX maybe do some sort of debug dump with the user that
	// we loaded from the server (or storage).

	s.user, err = LoadUser(LoadUserArg{self: true})

	if err != nil {
		return
	}

	if err = s.ProcessSigs(); err != nil {
		return
	}

	if err = s.Display(); err != nil {
		return
	}

	return
}

func (v *CmdSigsList) UseConfig() bool   { return true }
func (v *CmdSigsList) UseKeyring() bool  { return false }
func (v *CmdSigsList) UseAPI() bool      { return true }
func (v *CmdSigsList) UseTerminal() bool { return false }
