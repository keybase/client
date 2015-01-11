package libkb

import (
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"github.com/op/go-logging"
	"net"
	"os"
)

var (
	fancy_format = "%{color}%{time:15:04:05.000000} ▶ %{level:.4s} %{id:03x}%{color:reset} %{message}"
	plain_format = "%{level:.4s} %{id:03x} %{message}"
	nice_format  = "%{color}▶ %{level:.4s} %{message} %{color:reset}"
)

type Logger struct {
	logging.Logger
}

func (log *Logger) InitLogging() {
	logBackend := logging.NewLogBackend(os.Stderr, "", 0)
	logging.SetBackend(logBackend)
	logging.SetLevel(logging.INFO, "keybase")
}

func (log *Logger) Profile(fmts string, arg ...interface{}) {
	log.Debug(fmts, arg...)
}

func (log *Logger) PlainLogging() {
	logging.SetFormatter(logging.MustStringFormatter(plain_format))
}

func NewDefaultLogger() *Logger {
	log := logging.MustGetLogger("keybase")
	ret := &Logger{*log}
	ret.InitLogging()
	return ret
}

func (l *Logger) Configure(e *Env) {
	var fmt string
	if e.GetPlainLogging() {
		fmt = plain_format
	} else if e.GetDebug() {
		fmt = fancy_format
		logging.SetLevel(logging.DEBUG, "keybase")
	} else {
		fmt = nice_format

	}
	logging.SetFormatter(logging.MustStringFormatter(fmt))
}

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
	s := G.Env.GetLocalRpcDebug()
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
func (r *RpcLogOptions) TransportStart() bool { return r.connectionInfo || G.Daemon }

var __rpcLogOptions *RpcLogOptions

func getRpcLogOptions() *RpcLogOptions {
	if __rpcLogOptions == nil {
		__rpcLogOptions = &RpcLogOptions{}
		__rpcLogOptions.Reload()
	}
	return __rpcLogOptions
}

type RpcLogFactory struct{}

func NewRpcLogFactory() *RpcLogFactory {
	return &RpcLogFactory{}
}

func (r *RpcLogFactory) NewLog(a net.Addr) rpc2.LogInterface {
	ret := rpc2.SimpleLog{a, G.Log, getRpcLogOptions()}
	ret.TransportStart()
	return ret
}
