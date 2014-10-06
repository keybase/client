package libkb

import (
	"fmt"
)

type CmdLogin struct{}

func (v CmdLogin) Run() error {

	err := G.LoginState.Login()
	if err != nil {
		return err
	}

	err = G.LoginState.Login()
	if err != nil {
		return err
	}

	err = G.Terminal.Startup()
	if err != nil {
		return err
	}

	p, err := G.Terminal.PromptPassword("Your password> ")
	if err != nil {
		return err
	}
	G.Terminal.Write(fmt.Sprintf("Got pw: %s\n", p))
	p, err = G.Terminal.Prompt("Your username> ")
	if err != nil {
		return err
	}
	G.Terminal.Write(fmt.Sprintf("Got username: %s\n", p))

	return nil
}

func (v CmdLogin) UseConfig() bool   { return true }
func (v CmdLogin) UseKeyring() bool  { return true }
func (v CmdLogin) UseAPI() bool      { return true }
func (v CmdLogin) UseTerminal() bool { return true }
