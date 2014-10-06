package libkb

import (
	"fmt"
)

type CmdPing struct{}

func (v CmdPing) Run() error {
	_, err := G.API.Post(ApiArg{
		Endpoint: "ping",
		Args: HttpArgs{
			"alice":   S{"hi alice"},
			"bob":     I{1000},
			"charlie": B{true},
		},
	})
	if err != nil {
		return err
	}
	_, err = G.API.Get(ApiArg{Endpoint: "ping"})
	if err != nil {
		return err
	}
	G.Log.Info(fmt.Sprintf("API Server at %s is up", G.Env.GetServerUri()))
	return nil
}

func (v CmdPing) UseConfig() bool   { return true }
func (v CmdPing) UseKeyring() bool  { return false }
func (v CmdPing) UseAPI() bool      { return true }
func (v CmdPing) UseTerminal() bool { return false }
