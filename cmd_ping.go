
package libkb

import (
	"fmt"
)

type CmdPing struct {}

func (v CmdPing) Run() error {
	_, err := G.API.Get(ApiArg{ Endpoint : "ping" })
	if err == nil {
		G.Log.Info(fmt.Sprintf("API Server at %s is up", G.Env.GetServerUri()))

	}
	return err
}

func (v CmdPing) UseConfig() bool { return true }
func (v CmdPing) UseKeyring() bool { return false }
func (v CmdPing) UseAPI() bool { return true }
