package logger

import (
	"github.com/keybase/go-logging"
	"github.com/mattn/go-isatty"
	"os"
	"sync"
)

var globalLock sync.Mutex
var stderrIsTerminal = isatty.IsTerminal(os.Stderr.Fd())
var currentLogFileWriter *LogFileWriter
var stdErrLoggingShutdown chan<- struct{}
var stdErrLoggingShutdownDone <-chan struct{}

func init() {
	logBackend := logging.NewLogBackend(ErrorWriter(), "", 0)
	logging.SetBackend(logBackend)
}
