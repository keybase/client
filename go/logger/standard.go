package logger

import (
	"fmt"
	"os"
	"path"
	"strings"
	"sync"
	"syscall"

	logging "github.com/op/go-logging"
	"golang.org/x/net/context"
)

const (
	fancyFormat   = "%{color}%{time:15:04:05.000000} ▶ [%{level:.4s} %{module} %{shortfile}] %{id:03x}%{color:reset} %{message}"
	plainFormat   = "[%{level:.4s}] %{id:03x} %{message}"
	fileFormat    = "%{time:15:04:05.000000} ▶ [%{level:.4s} %{module} %{shortfile}] %{id:03x} %{message}"
	defaultFormat = "%{color}%{message}%{color:reset}"
)

const permDir os.FileMode = 0700

var initLoggingBackendOnce sync.Once
var logRotateMutex sync.Mutex

// CtxStandardLoggerKey is a type defining context keys used by the
// Standard logger.
type CtxStandardLoggerKey int

const (
	// CtxLogTags defines a context key that can hold a slice of context
	// keys, the value of which should be logged by a Standard logger if
	// one of those keys is seen in a context during a log call.
	CtxLogTagsKey CtxStandardLoggerKey = iota
)

type CtxLogTags map[interface{}]string

// NewContext returns a new Context that carries adds the given log
// tag mappings (context key -> display string).
func NewContextWithLogTags(
	ctx context.Context, logTagsToAdd CtxLogTags) context.Context {
	currTags, ok := LogTagsFromContext(ctx)
	if !ok {
		currTags = make(CtxLogTags)
	}
	for key, tag := range logTagsToAdd {
		currTags[key] = tag
	}
	return context.WithValue(ctx, CtxLogTagsKey, currTags)
}

// LogTagsFromContext returns the log tags being passed along with the
// given context.
func LogTagsFromContext(ctx context.Context) (CtxLogTags, bool) {
	logTags, ok := ctx.Value(CtxLogTagsKey).(CtxLogTags)
	return logTags, ok
}

type Standard struct {
	log            *logging.Logger
	filename       string
	configureMutex sync.Mutex
	module         string
}

// New creates a new Standard logger for module.
func New(module string) *Standard {
	return NewWithCallDepth(module, 0)
}

// NewWithCallDepth creates a new Standard logger for module, and when
// printing file names and line numbers, it goes extraCallDepth up the
// stack from where logger was invoked.
func NewWithCallDepth(module string, extraCallDepth int) *Standard {
	log := logging.MustGetLogger(module)
	log.ExtraCalldepth = 1 + extraCallDepth
	ret := &Standard{log: log, module: module}
	ret.initLogging()
	return ret
}

func (log *Standard) initLogging() {
	// Logging is always done to stderr. It's the responsibility of the
	// launcher (like launchd on OSX, or the autoforking code) to set up stderr
	// to point to the appropriate log file.
	initLoggingBackendOnce.Do(func() {
		logBackend := logging.NewLogBackend(os.Stderr, "", 0)
		logging.SetBackend(logBackend)
	})
	logging.SetLevel(logging.INFO, log.module)
}

func (log *Standard) prepareString(
	ctx context.Context, fmts string) string {
	if ctx == nil {
		return fmts
	}
	logTags, ok := LogTagsFromContext(ctx)
	if !ok || len(logTags) == 0 {
		return fmts
	}
	var tags []string
	for key, tag := range logTags {
		if v := ctx.Value(key); v != nil {
			tags = append(tags, fmt.Sprintf("%s=%s", tag, v))
		}
	}
	return fmts + " [tags:" + strings.Join(tags, ",") + "]"
}

func (log *Standard) Debug(fmt string, arg ...interface{}) {
	log.log.Debug(fmt, arg...)
}

func (log *Standard) CDebugf(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.log.IsEnabledFor(logging.DEBUG) {
		log.log.Debug(log.prepareString(ctx, fmt), arg...)
	}
}

func (log *Standard) Info(fmt string, arg ...interface{}) {
	log.log.Info(fmt, arg...)
}

func (log *Standard) CInfof(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.log.IsEnabledFor(logging.INFO) {
		log.log.Info(log.prepareString(ctx, fmt), arg...)
	}
}

func (log *Standard) Notice(fmt string, arg ...interface{}) {
	log.log.Notice(fmt, arg...)
}

func (log *Standard) CNoticef(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.log.IsEnabledFor(logging.NOTICE) {
		log.log.Notice(log.prepareString(ctx, fmt), arg...)
	}
}

func (log *Standard) Warning(fmt string, arg ...interface{}) {
	log.log.Warning(fmt, arg...)
}

func (log *Standard) CWarningf(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.log.IsEnabledFor(logging.WARNING) {
		log.log.Warning(log.prepareString(ctx, fmt), arg...)
	}
}

func (log *Standard) Error(fmt string, arg ...interface{}) {
	log.log.Error(fmt, arg...)
}

func (log *Standard) Errorf(fmt string, arg ...interface{}) {
	log.log.Error(fmt, arg...)
}

func (log *Standard) CErrorf(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.log.IsEnabledFor(logging.ERROR) {
		log.log.Error(log.prepareString(ctx, fmt), arg...)
	}
}

func (log *Standard) Critical(fmt string, arg ...interface{}) {
	log.log.Critical(fmt, arg...)
}

func (log *Standard) CCriticalf(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.log.IsEnabledFor(logging.CRITICAL) {
		log.log.Critical(log.prepareString(ctx, fmt), arg...)
	}
}

func (log *Standard) Fatalf(fmt string, arg ...interface{}) {
	log.log.Fatalf(fmt, arg...)
}

func (log *Standard) CFatalf(ctx context.Context, fmt string,
	arg ...interface{}) {
	log.log.Fatalf(log.prepareString(ctx, fmt), arg...)
}

func (log *Standard) Profile(fmts string, arg ...interface{}) {
	log.log.Debug(fmts, arg...)
}

func (log *Standard) Configure(style string, debug bool, filename string) {
	log.configureMutex.Lock()
	defer log.configureMutex.Unlock()

	log.filename = filename

	var logfmt string
	if debug {
		logfmt = fancyFormat
	} else {
		logfmt = defaultFormat
	}

	// Override the format above if an explicit style was specified.
	switch style {
	case "default":
		logfmt = defaultFormat // Default
	case "plain":
		logfmt = plainFormat // Plain
	case "file":
		logfmt = fileFormat // Good for logging to files
	case "fancy":
		logfmt = fancyFormat // Fancy, good for terminals with color
	}

	if debug {
		logging.SetLevel(logging.DEBUG, log.module)
	}

	logging.SetFormatter(logging.MustStringFormatter(logfmt))
}

func (log *Standard) RotateLogFile() error {
	logRotateMutex.Lock()
	defer logRotateMutex.Unlock()
	log.log.Info("Rotating log file; closing down old file")
	_, file, err := OpenLogFile(log.filename)
	if err != nil {
		return err
	}
	err = PickFirstError(
		syscall.Close(1),
		syscall.Close(2),
		syscall.Dup2(int(file.Fd()), 1),
		syscall.Dup2(int(file.Fd()), 2),
		file.Close(),
	)
	if err != nil {
		log.log.Warning("Couldn't rotate file: %v", err)
	}
	log.log.Info("Rotated log file; opening up new file")
	return nil
}

func OpenLogFile(filename string) (name string, file *os.File, err error) {
	name = filename
	if err = MakeParentDirs(name); err != nil {
		return
	}
	file, err = os.OpenFile(name, (os.O_APPEND | os.O_WRONLY | os.O_CREATE), 0600)
	if err != nil {
		return
	}
	return
}

func FileExists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

func MakeParentDirs(filename string) error {
	dir, _ := path.Split(filename)
	exists, err := FileExists(dir)
	if err != nil {
		return err
	}

	if !exists {
		err = os.MkdirAll(dir, permDir)
		if err != nil {
			return err
		}
	}
	return nil
}

func PickFirstError(errors ...error) error {
	for _, e := range errors {
		if e != nil {
			return e
		}
	}
	return nil
}
