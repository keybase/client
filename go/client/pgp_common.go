package client

import (
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

func NewStreamUIProtocol() rpc.Protocol {
	return keybase1.StreamUiProtocol(G.XStreams)
}
