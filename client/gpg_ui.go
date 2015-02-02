package main

import (
	keybase_1 "github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewGPGUIProtocol() rpc2.Protocol {
	return keybase_1.GpgUiProtocol(&GPGUIServer{G_UI.GetGPGUI()})
}

type GPGUIServer struct {
	eng keybase_1.GpgUiInterface
}

func (g *GPGUIServer) SelectKey(arg keybase_1.SelectKeyArg) (res keybase_1.SelectKeyRes, err error) {
	return g.eng.SelectKey(arg)
}
