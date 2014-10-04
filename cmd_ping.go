
package libkb

import (
)

type CmdPing struct {}

func (v CmdPing) Run() error {
	_, err := G.API.Get(ApiArg{ Endpoint : "ping" })
	return err
}

func (v CmdPing) UseConfig() bool { return true }
func (v CmdPing) UseKeyring() bool { return false }
func (v CmdPing) UseAPI() bool { return true }
