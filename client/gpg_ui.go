package main

import (
	keybase_1 "github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewGPGUIProtocol() rpc2.Protocol {
	return keybase_1.GpgUiProtocol(G_UI.GetGPGUI())
}
