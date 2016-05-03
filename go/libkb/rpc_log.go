// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"net"
	"sync"

	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

// RPC log options, can turn on debugging, &c.

type RPCLogOptions struct {
	Contextified
	clientTrace    bool
	serverTrace    bool
	profile        bool
	verboseTrace   bool
	connectionInfo bool
	noAddress      bool
}

func (r *RPCLogOptions) Reload() {
	s := r.G().Env.GetLocalRPCDebug()
	r.clientTrace = false
	r.serverTrace = false
	r.profile = false
	r.verboseTrace = false
	r.connectionInfo = false
	r.noAddress = false
	for _, c := range s {
		switch c {
		case 'A':
			r.noAddress = true
		case 'c':
			r.clientTrace = true
		case 's':
			r.serverTrace = true
		case 'v':
			r.verboseTrace = true
		case 'i':
			r.connectionInfo = true
		case 'p':
			r.profile = true
		default:
			r.G().Log.Warning("Unknown local RPC logging flag: %c", c)
		}
	}
}

func (r *RPCLogOptions) ShowAddress() bool    { return !r.noAddress }
func (r *RPCLogOptions) ShowArg() bool        { return r.verboseTrace }
func (r *RPCLogOptions) ShowResult() bool     { return r.verboseTrace }
func (r *RPCLogOptions) Profile() bool        { return r.profile }
func (r *RPCLogOptions) ClientTrace() bool    { return r.clientTrace }
func (r *RPCLogOptions) ServerTrace() bool    { return r.serverTrace }
func (r *RPCLogOptions) TransportStart() bool { return r.connectionInfo || G.Service }

var rpcLogOptions *RPCLogOptions
var rpcLogOptionsOnce sync.Once

func getRPCLogOptions(g *GlobalContext) *RPCLogOptions {
	rpcLogOptionsOnce.Do(func() {
		rpcLogOptions = &RPCLogOptions{Contextified: NewContextified(g)}
		rpcLogOptions.Reload()
	})
	return rpcLogOptions
}

type RPCLogFactory struct {
	Contextified
}

func NewRPCLogFactory(g *GlobalContext) *RPCLogFactory {
	return &RPCLogFactory{Contextified: NewContextified(g)}
}

func (r *RPCLogFactory) NewLog(a net.Addr) rpc.LogInterface {
	ret := rpc.SimpleLog{Addr: a, Out: r.G().GetUnforwardedLogger(), Opts: getRPCLogOptions(r.G())}
	ret.TransportStart()
	return ret
}
