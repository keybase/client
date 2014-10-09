package libkb

import (
	"fmt"
	"github.com/codegangsta/cli"
	"runtime"
)

type CmdVersion struct{}

func VersionMessage(linefn func(string)) {
	linefn(fmt.Sprintf("Keybase Command-Line App v%s", CLIENT_VERSION))
	linefn(fmt.Sprintf("- Built with %s", runtime.Version()))
	linefn("- Visit https://keybase.io for more details")
}

func (v *CmdVersion) Run() error {
	VersionMessage(func(s string) { fmt.Println(s) })
	return nil
}

func (v *CmdVersion) UseConfig() bool               { return true }
func (v *CmdVersion) UseKeyring() bool              { return false }
func (v *CmdVersion) UseAPI() bool                  { return false }
func (v *CmdVersion) UseTerminal() bool             { return false }
func (c *CmdVersion) Initialize(*cli.Context) error { return nil }
