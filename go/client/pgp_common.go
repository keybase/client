package client

import (
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewStreamUiProtocol() rpc2.Protocol {
	return keybase_1.StreamUiProtocol(G.XStreams)
}
