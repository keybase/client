package libkb

import (
	"fmt"
	"github.com/codegangsta/cli"
	"os"
	"regexp"
	"strings"
)

type CmdSigsList struct {
	filter  string
	revoked bool
	json    bool
	verbose bool
	allKeys bool
	headers bool
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
	s.allKeys = ctx.Bool("all-keys")
	s.headers = ctx.Bool("headers")

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

	var cols []string

	if s.headers {
		cols = []string{
			"#",
			"SigId",
			"Type",
			"Date",
		}
		if s.revoked {
			cols = append(cols, "Revoked")
		}
		if s.allKeys {
			cols = append(cols, "Active", "Key")
		}
		cols = append(cols, "Body")
	}

	i := 0
	idtab := s.user.idTable

	rowfunc := func() []string {
		var row []string
		for ; i < idtab.Len() && row == nil; i++ {
			link := idtab.order[i]
			if !s.revoked && link.IsRevoked() {
				continue
			}
			if !s.allKeys && !link.IsActiveKey() {
				continue
			}
			row := []string{
				fmt.Sprintf("%d", int(link.GetSeqno())),
				link.GetSigId().ToDisplayString(s.verbose),
				FormatTime(link.GetCTime()),
			}
			if s.revoked {
				var ch string
				if link.IsRevoked() {
					ch = "-"
				} else {
					ch = "+"
				}
				row = append(row, ch)
			}
			if s.allKeys {
				var ch string
				if link.IsActiveKey() {
					ch = "+"
				} else {
					ch = "-"
				}
				key := link.GetPgpFingerprint().ToDisplayString(s.verbose)
				row = append(row, ch, key)
			}
			row = append(row, link.ToDisplayString())
		}
		i++
		return row
	}

	Tablify(os.Stdout, cols, rowfunc)

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

	s.user, err = LoadUser(LoadUserArg{self: true, allKeys: s.allKeys})

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
