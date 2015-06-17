package libkb

import (
	"net"
	"sync"

	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// RPC log options, can turn on debugging, &c.

type RpcLogOptions struct {
	clientTrace    bool
	serverTrace    bool
	profile        bool
	verboseTrace   bool
	connectionInfo bool
	noAddress      bool
}

func (r *RpcLogOptions) Reload() {
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

func (r *RpcLogOptions) ShowAddress() bool    { return !r.noAddress }
func (r *RpcLogOptions) ShowArg() bool        { return r.verboseTrace }
func (r *RpcLogOptions) ShowResult() bool     { return r.verboseTrace }
func (r *RpcLogOptions) Profile() bool        { return r.profile }
func (r *RpcLogOptions) ClientTrace() bool    { return r.clientTrace }
func (r *RpcLogOptions) ServerTrace() bool    { return r.serverTrace }
func (r *RpcLogOptions) TransportStart() bool { return r.connectionInfo || G.Service }

var rpcLogOptions *RpcLogOptions
var rpcLogOptionsOnce sync.Once

func getRpcLogOptions() *RpcLogOptions {
	rpcLogOptionsOnce.Do(func() {
		rpcLogOptions = &RpcLogOptions{}
		rpcLogOptions.Reload()
	})
	return rpcLogOptions
}

type RpcLogFactory struct{}

func NewRpcLogFactory() *RpcLogFactory {
	return &RpcLogFactory{}
}

func (r *RpcLogFactory) NewLog(a net.Addr) rpc2.LogInterface {
	ret := rpc2.SimpleLog{Addr: a, Out: G.Log, Opts: getRpcLogOptions()}
	ret.TransportStart()
	return ret
}
