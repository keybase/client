package rpc2

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"time"
)

type Profiler interface {
	Stop()
}

type LogInterface interface {
	TransportStart()
	TransportError(error)
	ServerCall(int, string, error, interface{})
	ServerReply(int, string, error, interface{})
	ClientCall(int, string, interface{})
	ClientReply(int, string, error, interface{})
	StartProfiler(format string, args ...interface{}) Profiler
	UnexpectedReply(int)
	Warning(format string, args ...interface{})
}

type LogFactory interface {
	NewLog(net.Addr) LogInterface
}

type LogOutput interface {
	Error(s string, args ...interface{})
	Warning(s string, args ...interface{})
	Info(s string, args ...interface{})
	Debug(s string, args ...interface{})
	Profile(s string, args ...interface{})
}

type LogOptions interface {
	ShowAddress() bool
	ShowArg() bool
	ShowResult() bool
	Profile() bool
	ClientTrace() bool
	ServerTrace() bool
	TransportStart() bool
}

//-------------------------------------------------

type SimpleLogFactory struct {
	out  LogOutput
	opts LogOptions
}

type SimpleLog struct {
	Addr net.Addr
	Out  LogOutput
	Opts LogOptions
}

type SimpleLogOutput struct{}
type SimpleLogOptions struct{}

func (so SimpleLogOutput) log(ch string, fmts string, args []interface{}) {
	fmts = fmt.Sprintf("[%s] %s\n", ch, fmts)
	fmt.Fprintf(os.Stderr, fmts, args...)
}

func (s SimpleLogOutput) Info(fmt string, args ...interface{})    { s.log("I", fmt, args) }
func (s SimpleLogOutput) Error(fmt string, args ...interface{})   { s.log("E", fmt, args) }
func (s SimpleLogOutput) Debug(fmt string, args ...interface{})   { s.log("D", fmt, args) }
func (s SimpleLogOutput) Warning(fmt string, args ...interface{}) { s.log("W", fmt, args) }
func (s SimpleLogOutput) Profile(fmt string, args ...interface{}) { s.log("P", fmt, args) }

func (so SimpleLogOptions) ShowAddress() bool    { return true }
func (so SimpleLogOptions) ShowArg() bool        { return true }
func (so SimpleLogOptions) ShowResult() bool     { return true }
func (so SimpleLogOptions) Profile() bool        { return true }
func (so SimpleLogOptions) ClientTrace() bool    { return true }
func (so SimpleLogOptions) ServerTrace() bool    { return true }
func (so SimpleLogOptions) TransportStart() bool { return true }

func NewSimpleLogFactory(out LogOutput, opts LogOptions) SimpleLogFactory {
	if out == nil {
		out = SimpleLogOutput{}
	}
	if opts == nil {
		opts = SimpleLogOptions{}
	}
	ret := SimpleLogFactory{out, opts}
	return ret
}

func (s SimpleLogFactory) NewLog(a net.Addr) LogInterface {
	ret := SimpleLog{a, s.out, s.opts}
	ret.TransportStart()
	return ret
}

func AddrToString(addr net.Addr) string {
	if addr == nil {
		return "-"
	} else {
		c := addr.String()
		if len(c) == 0 {
			return addr.Network()
		} else {
			return addr.Network() + "://" + c
		}
	}
}

func (l SimpleLog) TransportStart() {
	if l.Opts.TransportStart() {
		l.Out.Info(l.msg(true, "New connection"))
	}
}

func (l SimpleLog) TransportError(e error) {
	if e != io.EOF {
		l.Out.Error(l.msg(true, "Error in transport: %s", e.Error()))
	} else if l.Opts.TransportStart() {
		l.Out.Info(l.msg(true, "EOF"))
	}
	return
}

func (s SimpleLog) ServerReply(q int, meth string, err error, res interface{}) {
	if s.Opts.ServerTrace() {
		s.trace("reply", "res", s.Opts.ShowResult(), q, meth, err, res)
	}
}
func (s SimpleLog) ServerCall(q int, meth string, err error, arg interface{}) {
	if s.Opts.ServerTrace() {
		s.trace("serve", "arg", s.Opts.ShowArg(), q, meth, err, arg)
	}
}
func (s SimpleLog) ClientCall(q int, meth string, arg interface{}) {
	if s.Opts.ClientTrace() {
		s.trace("call", "arg", s.Opts.ShowArg(), q, meth, nil, arg)
	}
}
func (s SimpleLog) ClientReply(q int, meth string, err error, res interface{}) {
	if s.Opts.ClientTrace() {
		s.trace("reply", "res", s.Opts.ShowResult(), q, meth, err, res)
	}
}

func (s SimpleLog) trace(which string, objname string, verbose bool, q int, meth string, err error, obj interface{}) {
	args := []interface{}{which, q}
	fmts := "%s(%d):"
	if len(meth) > 0 {
		fmts += " method=%s;"
		args = append(args, meth)
	}
	fmts += " err=%s;"
	var es string
	if err == nil {
		es = "null"
	} else {
		es = err.Error()
	}
	args = append(args, es)
	if verbose {
		fmts += " %s=%s;"
		eb, err := json.Marshal(obj)
		var es string
		if err != nil {
			es = fmt.Sprintf(`{"error": "%s"}`, err.Error())
		} else {
			es = string(eb)
		}
		args = append(args, objname)
		args = append(args, es)
	}
	s.Out.Debug(s.msg(false, fmts, args...))
}

func (s SimpleLog) StartProfiler(format string, args ...interface{}) Profiler {
	if s.Opts.Profile() {
		return SimpleProfiler{
			start: time.Now(),
			msg:   fmt.Sprintf(format, args...),
			log:   s,
		}
	} else {
		return nil
	}
}

func (s SimpleLog) UnexpectedReply(seqno int) {
	s.Out.Warning(s.msg(false, "Unexpected seqno %d in incoming reply", seqno))
}

func (s SimpleLog) Warning(format string, args ...interface{}) {
	s.Out.Warning(s.msg(false, format, args...))
}

func (l SimpleLog) msg(force bool, format string, args ...interface{}) string {
	m1 := fmt.Sprintf(format, args...)
	if l.Opts.ShowAddress() || force {
		m2 := fmt.Sprintf("{%s} %s", AddrToString(l.Addr), m1)
		m1 = m2
	}
	return m1
}

type SimpleProfiler struct {
	start time.Time
	msg   string
	log   SimpleLog
}

func (s SimpleProfiler) Stop() {
	stop := time.Now()
	diff := stop.Sub(s.start)
	s.log.Out.Profile(s.log.msg(false, "%s ran in %dms", s.msg, diff/time.Millisecond))
}
