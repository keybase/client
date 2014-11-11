package libkb

import (
	"github.com/op/go-logging"
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
