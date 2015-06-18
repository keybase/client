package libkb

import (
	"net"
	"sync"

	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// RPC log options, can turn on debugging, &c.

type RPCLogOptions struct {
	clientTrace    bool
	serverTrace    bool
	profile        bool
	verboseTrace   bool
	connectionInfo bool
	noAddress      bool
}

func (r *RPCLogOptions) Reload() {
	s := G.Env.GetLocalRPCDebug()
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
			G.Log.Warning("Unknown local RPC logging flag: %c", c)
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

func getRPCLogOptions() *RPCLogOptions {
	rpcLogOptionsOnce.Do(func() {
		rpcLogOptions = &RPCLogOptions{}
		rpcLogOptions.Reload()
	})
	return rpcLogOptions
}

type RPCLogFactory struct{}

func NewRPCLogFactory() *RPCLogFactory {
	return &RPCLogFactory{}
}

func (r *RPCLogFactory) NewLog(a net.Addr) rpc2.LogInterface {
	ret := rpc2.SimpleLog{Addr: a, Out: G.Log, Opts: getRPCLogOptions()}
	ret.TransportStart()
	return ret
}
