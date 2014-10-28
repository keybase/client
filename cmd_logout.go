package libkb

import (
	"github.com/codegangsta/cli"
)

type CmdLogout struct{}

func (v *CmdLogout) Run() error {

	err := G.LoginState.Logout()
	if err != nil {
		return err
	}
	return nil
}

func (v *CmdLogout) UseConfig() bool               { return true }
func (v *CmdLogout) UseKeyring() bool              { return false }
func (v *CmdLogout) UseAPI() bool                  { return true }
func (v *CmdLogout) UseTerminal() bool             { return false }
func (c *CmdLogout) Initialize(*cli.Context) error { return nil }
