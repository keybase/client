package libkb

import (
	"net"
	"os"
	"sync"
	"syscall"

	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	logging "github.com/op/go-logging"
)

const (
	fancyFormat = "%{color}%{time:15:04:05.000000} ▶ %{level:.4s} %{id:03x}%{color:reset} %{message}"
	plainFormat = "%{level:.4s} %{id:03x} %{message}"
	niceFormat  = "%{color}▶ %{level:.4s} %{message} %{color:reset}"
)

type Logger struct {
	logging.Logger
	rotateMutex    sync.Mutex
	configureMutex sync.Mutex
}

func (log *Logger) initLogging() {
	logBackend := logging.NewLogBackend(os.Stderr, "", 0)
	logging.SetBackend(logBackend)
	logging.SetLevel(logging.INFO, "keybase")
}

func (log *Logger) Profile(fmts string, arg ...interface{}) {
	log.Debug(fmts, arg...)
}

func (log *Logger) Errorf(fmt string, arg ...interface{}) {
	log.Error(fmt, arg...)
}

func (log *Logger) PlainLogging() {
	log.configureMutex.Lock()
	defer log.configureMutex.Unlock()
	logging.SetFormatter(logging.MustStringFormatter(plainFormat))
}

func NewDefaultLogger() *Logger {
	log := logging.MustGetLogger("keybase")
	ret := &Logger{Logger: *log}
	ret.initLogging()
	return ret
}

func (log *Logger) Configure(e *Env) {
	log.configureMutex.Lock()
	defer log.configureMutex.Unlock()
	var fmt string
	if e.GetPlainLogging() {
		fmt = plainFormat
	} else if e.GetDebug() {
		fmt = fancyFormat
		logging.SetLevel(logging.DEBUG, "keybase")
	} else {
		fmt = niceFormat

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

func (log *Logger) RotateLogFile() error {
	log.rotateMutex.Lock()
	defer log.rotateMutex.Unlock()
	G.Log.Info("Rotating log file; closing down old file")
	_, file, err := OpenLogFile()
	if err != nil {
		return err
	}
	err = PickFirstError(
		syscall.Close(1),
		syscall.Close(2),
		syscall.Dup2(int(file.Fd()), 1),
		syscall.Dup2(int(file.Fd()), 2),
		file.Close(),
	)
	G.Log.Info("Rotated log file; opening up new file")
	return err
}
