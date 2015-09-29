package client

import (
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

func NewStreamUIProtocol() rpc2.Protocol {
	return keybase1.StreamUiProtocol(G.XStreams)
}
