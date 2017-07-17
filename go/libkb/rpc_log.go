// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"net"

	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type RPCLogFactory struct {
	Contextified
}

func NewRPCLogFactory(g *GlobalContext) *RPCLogFactory {
	return &RPCLogFactory{Contextified: NewContextified(g)}
}

func (r *RPCLogFactory) NewLog(a net.Addr) rpc.LogInterface {
	opts := rpc.NewStandardLogOptions(r.G().Env.GetLocalRPCDebug(), r.G().Log)
	ret := rpc.SimpleLog{Addr: a, Out: r.G().GetUnforwardedLogger(), Opts: opts}
	ret.TransportStart()
	return ret
}
