package logger

import (
	"fmt"
	"os"
	"sync"
	"time"

	logging "github.com/keybase/go-logging"
)

// LogFileConfig is the config structure for new style log files with rotation.
type LogFileConfig struct {
	// Path is the path of the log file to use
	Path string
	// MaxSize is the size of log file before rotation, 0 for infinite.
	MaxSize int64
	// MaxAge is th duration before log rotation, zero value for infinite.
	MaxAge time.Duration
}

// SetLogFileConfig sets the log file config to be used globally.
func SetLogFileConfig(lfc *LogFileConfig) error {
	globalLock.Lock()
	defer globalLock.Unlock()

	first := true
	var w = currentLogFileWriter
	if w != nil {
		first = false
		w.lock.Lock()
		defer w.lock.Unlock()
		w.Close()
	} else {
		w = &logFileWriter{}
	}
	w.config = *lfc

	err := w.Open(time.Now())
	if err != nil {
		return err
	}

	if first {
		fileBackend := logging.NewLogBackend(w, "", 0)
		logging.SetBackend(fileBackend)

		stderrIsTerminal = false
		currentLogFileWriter = w
	}
	return nil
}

type logFileWriter struct {
	lock         sync.Mutex
	config       LogFileConfig
	file         *os.File
	currentSize  int64
	currentStart time.Time
}

func (lfw *logFileWriter) Open(at time.Time) error {
	var err error
	_, lfw.file, err = OpenLogFile(lfw.config.Path)
	if err != nil {
		return err
	}
	lfw.currentStart = at
	lfw.currentSize = 0
	fi, err := lfw.file.Stat()
	if err != nil {
		return err
	}
	lfw.currentSize = fi.Size()
	return nil
}

func (lfw *logFileWriter) Close() error {
	if lfw == nil {
		return nil
	}
	lfw.lock.Lock()
	defer lfw.lock.Unlock()
	if lfw.file == nil {
		return nil
	}
	return lfw.file.Close()
}

const zeroDuration time.Duration = 0

func (lfw *logFileWriter) Write(bs []byte) (int, error) {
	lfw.lock.Lock()
	defer lfw.lock.Unlock()
	n, err := lfw.file.Write(bs)
	if err != nil {
		return n, err
	}
	needRotation := false
	if lfw.config.MaxSize > 0 {
		lfw.currentSize += int64(n)
		needRotation = needRotation || lfw.currentSize > lfw.config.MaxSize
	}
	if lfw.config.MaxAge != zeroDuration {
		elapsed := time.Since(lfw.currentStart)
		needRotation = needRotation || elapsed > lfw.config.MaxAge
	}
	if !needRotation {
		return n, nil
	}
	// Close first because some systems don't like to rename otherwise.
	lfw.file.Close()
	lfw.file = nil
	now := time.Now()
	start := lfw.currentStart.Format("20060102T150405")
	end := now.Format("20060102T150405")
	tgt := fmt.Sprintf("%s-%s-%s", lfw.config.Path, start, end)
	// Handle the error further down
	err = os.Rename(lfw.config.Path, tgt)
	if err != nil {
		return n, err
	}
	err = lfw.Open(now)
	return n, err
}
