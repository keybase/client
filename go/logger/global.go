package logger

import (
	"os"
	"sync"
	"time"

	"github.com/keybase/go-logging"
	"github.com/mattn/go-isatty"
)

const logMS = 10
const loggingFrequency = logMS * time.Millisecond

var globalLock sync.Mutex
var stderrIsTerminal = isatty.IsTerminal(os.Stderr.Fd())
var currentLogFileWriter *LogFileWriter
var stdErrLoggingShutdown chan<- struct{}

func init() {
	writer, shutdown := NewAutoFlushingBufferedWriter(ErrorWriter(), loggingFrequency)
	stdErrLoggingShutdown = shutdown
	logBackend := logging.NewLogBackend(writer, "", 0)
	logging.SetBackend(logBackend)
}
