// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

func NewStreamUIProtocol(g *libkb.GlobalContext) rpc.Protocol {
	return keybase1.StreamUiProtocol(g.XStreams)
}
