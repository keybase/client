package logger

import (
	"os"
	"sync"
	"time"

	logging "github.com/keybase/go-logging"
	isatty "github.com/mattn/go-isatty"
)

const logMS = 10
const loggingFrequency = logMS * time.Millisecond

var globalLock sync.Mutex
var stderrIsTerminal = isatty.IsTerminal(os.Stderr.Fd())
var currentLogFileWriter *LogFileWriter
var stdErrLoggingShutdown chan<- struct{}
var stdErrLoggingShutdownDone <-chan struct{}

func init() {
	writer, shutdown, done := NewAutoFlushingBufferedWriter(ErrorWriter(), loggingFrequency)
	stdErrLoggingShutdown = shutdown
	stdErrLoggingShutdownDone = done
	logBackend := logging.NewLogBackend(writer, "", 0)
	logging.SetBackend(logBackend)
}

// Shutdown shuts down logger, flushing remaining logs if a backend with
// buffering is used.
func Shutdown() {
	select {
	case stdErrLoggingShutdown <- struct{}{}:
		// Wait till logger is done
		select {
		case <-stdErrLoggingShutdownDone:
		}
	default:
	}
}
