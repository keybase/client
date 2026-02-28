package logger

import (
	"os"
	"sync"

	"github.com/keybase/go-logging"
	"github.com/mattn/go-isatty"
)

var (
	globalLock                sync.Mutex
	stderrIsTerminal          = isatty.IsTerminal(os.Stderr.Fd())
	currentLogFileWriter      *LogFileWriter
	stdErrLoggingShutdown     chan<- struct{}
	stdErrLoggingShutdownDone <-chan struct{}
)

func init() {
	logBackend := logging.NewLogBackend(ErrorWriter(), "", 0)
	logging.SetBackend(logBackend)
}
