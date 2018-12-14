package logger

import (
	"os"
	"sync"

	logging "github.com/keybase/go-logging"
	isatty "github.com/mattn/go-isatty"
)

var globalLock sync.Mutex
var stderrIsTerminal = isatty.IsTerminal(os.Stderr.Fd())
var currentLogFileWriter *logFileWriter

func init() {
	logBackend := logging.NewLogBackend(ErrorWriter(), "", 0)
	logging.SetBackend(logBackend)
}
