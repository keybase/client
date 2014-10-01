

package libkb

import (
	"os"
	"github.com/op/go-logging"
)

type Logger struct {
	logging.Logger
}

func (log *Logger) InitLogging() {
	logBackend := logging.NewLogBackend(os.Stderr, "", 0)
	var format = "%{color}%{time:15:04:05.000000} ▶ %{level:.4s} %{id:03x}%{color:reset} %{message}"
	logging.SetBackend(logBackend)
    logging.SetFormatter(logging.MustStringFormatter(format))
    logging.SetLevel(logging.INFO, "keybase")
}

func (log *Logger) PlainLogging() {
	var format = "%{level:.4s} %{id:03x} %{message}"
    logging.SetFormatter(logging.MustStringFormatter(format))
}

func NewDefaultLogger() *Logger {
	log := logging.MustGetLogger("keybase")
	ret := &Logger { *log }
	ret.InitLogging()
	return ret
}

func (l *Logger) Configure(e *Env) {
	if e.GetPlainLogging() { l.PlainLogging() }
	if e.GetDebug() { logging.SetLevel(logging.DEBUG, "keybase") }
}

