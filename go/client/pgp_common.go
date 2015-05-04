package client

import (
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewStreamUiProtocol() rpc2.Protocol {
	return keybase1.StreamUiProtocol(G.XStreams)
}
