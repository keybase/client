package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"sync"
	"time"

	logging "github.com/keybase/go-logging"
)

// LogFileConfig is the config structure for new style log files with rotation.
type LogFileConfig struct {
	// Path is the path of the log file to use
	Path string
	// MaxSize is the size of log file (in bytes) before rotation, 0 for infinite.
	MaxSize int64
	// MaxAge is the duration before log rotation, zero value for infinite.
	MaxAge time.Duration
	// MaxKeepFiles is maximum number of log files for this service, older
	// files are deleted.
	MaxKeepFiles int
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
	tryRedirectStderrTo(lfw.file)
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
	// Spawn old log deletion worker if we have a max-amount of log-files.
	if lfw.config.MaxKeepFiles > 0 {
		go deleteOldLogFilesIfNeeded(lfw.config)
	}
	err = lfw.Open(now)
	return n, err
}

func deleteOldLogFilesIfNeeded(config LogFileConfig) {
	err := deleteOldLogFilesIfNeededWorker(config)
	if err != nil {
		log := New("logger")
		log.Warning("Deletion of old log files failed: %v", err)
	}
}

func deleteOldLogFilesIfNeededWorker(config LogFileConfig) error {
	// Returns list of old log files (not the current one) sorted.
	// The oldest one is first in the list.
	entries, err := scanOldLogFiles(config.Path)
	if err != nil {
		return err
	}
	// entries has only the old renamed log files, not the current
	// log file. E.g. if MaxKeepFiles is 2 then we keep the current
	// file and one archived log file. If there are 3 archived files
	// then removeN = 1 + 3 - 2 = 2.
	removeN := 1 + len(entries) - config.MaxKeepFiles
	if config.MaxKeepFiles <= 0 || removeN <= 0 {
		return nil
	}
	// Try to remove all old log files that we want to remove, and
	// don't stop on the first error.
	for i := 0; i < removeN; i++ {
		err2 := os.Remove(entries[i])
		if err == nil {
			err = err2
		}
	}
	return err
}

// scanOldLogFiles finds old archived log files corresponding to the log file path.
// Returns the list of such log files sorted with the eldest one first.
func scanOldLogFiles(path string) ([]string, error) {
	dname, fname := filepath.Split(path)
	if dname == "" {
		dname = "."
	}
	dir, err := os.Open(dname)
	if err != nil {
		return nil, err
	}
	defer dir.Close()
	ns, err := dir.Readdirnames(-1)
	if err != nil {
		return nil, err
	}
	var res []string
	re, err := regexp.Compile(`^` + regexp.QuoteMeta(fname) + `-\d{8}T\d{6}-\d{8}T\d{6}$`)
	if err != nil {
		return nil, err
	}
	for _, name := range ns {
		if re.MatchString(name) {
			res = append(res, filepath.Join(dname, name))
		}
	}
	sort.Strings(res)
	return res, nil
}
