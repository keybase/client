package main

import (
	keybase_1 "github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type RemoteGPGUI struct {
	sessionId int
	uicli     keybase_1.GpgUiClient
}

func NewRemoteGPGUI(sessionId int, c *rpc2.Client) *RemoteGPGUI {
	return &RemoteGPGUI{
		sessionId: sessionId,
		uicli:     keybase_1.GpgUiClient{c},
	}
}

func (r *RemoteGPGUI) SelectKey(arg keybase_1.SelectKeyArg) (keybase_1.SelectKeyRes, error) {
	return r.uicli.SelectKey(arg)
}

func (r *RemoteGPGUI) WantToAddGPGKey() (bool, error) {
	return r.uicli.WantToAddGPGKey()
}
