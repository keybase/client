// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package logger

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"

	logging "github.com/keybase/go-logging"
	isatty "github.com/mattn/go-isatty"
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol"
)

const permDir os.FileMode = 0700

var initLoggingBackendOnce sync.Once
var logRotateMutex sync.Mutex

// Map from module name to whether SetLevel() has been called for that
// module.
var initLoggingSetLevelCalled map[string]bool

// Protects access to initLoggingSetLevelCalled and the actual
// SetLevel call.
var initLoggingSetLevelMutex sync.Mutex

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

type ExternalLogger interface {
	Log(level keybase1.LogLevel, format string, args []interface{})
}

type entry struct {
	level  keybase1.LogLevel
	format string
	args   []interface{}
}

type Standard struct {
	internal       *logging.Logger
	filename       string
	configureMutex sync.Mutex
	module         string
	isTerminal     bool

	externalLoggers      map[uint64]ExternalLogger
	externalLoggersCount uint64
	externalLogLevel     keybase1.LogLevel
	externalLoggersMutex sync.RWMutex

	buffer   chan *entry
	drop     chan bool
	shutdown bool
}

// Verify Standard fully implements the Logger interface.
var _ Logger = (*Standard)(nil)

// New creates a new Standard logger for module.
func New(module string, iow io.Writer) *Standard {
	return NewWithCallDepth(module, 0, iow)
}

// NewWithCallDepth creates a new Standard logger for module, and when
// printing file names and line numbers, it goes extraCallDepth up the
// stack from where logger was invoked.
func NewWithCallDepth(module string, extraCallDepth int, iow io.Writer) *Standard {
	log := logging.MustGetLogger(module)
	log.ExtraCalldepth = 1 + extraCallDepth

	// If iow's implementation has an Fd() method, call it and
	// check if the underlying file descriptor is a terminal.
	isTerminal := false
	if fdOwner, ok := iow.(interface {
		Fd() uintptr
	}); ok {
		isTerminal = isatty.IsTerminal(fdOwner.Fd())
	}

	ret := &Standard{
		internal:             log,
		module:               module,
		externalLoggers:      make(map[uint64]ExternalLogger),
		externalLoggersCount: 0,
		externalLogLevel:     keybase1.LogLevel_INFO,
		isTerminal:           isTerminal,
		buffer:               make(chan *entry, 10000),
		drop:                 make(chan bool, 1),
	}
	ret.initLogging(iow)
	go ret.processBuffer()
	return ret
}

func (log *Standard) initLogging(iow io.Writer) {
	// Logging is always done to the given io.Writer. It's the
	// responsibility of the launcher (like launchd on OSX, or the
	// autoforking code) to set it up to point to the appropriate
	// log file.
	initLoggingBackendOnce.Do(func() {
		logBackend := logging.NewLogBackend(iow, "", 0)
		logging.SetBackend(logBackend)
	})

	initLoggingSetLevelMutex.Lock()
	defer initLoggingSetLevelMutex.Unlock()
	if initLoggingSetLevelCalled == nil {
		initLoggingSetLevelCalled = make(map[string]bool)
	}
	if !initLoggingSetLevelCalled[log.module] {
		logging.SetLevel(logging.INFO, log.module)
		initLoggingSetLevelCalled[log.module] = true
	}
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
	log.internal.Debug(fmt, arg...)
	log.logToExternalLoggers(keybase1.LogLevel_DEBUG, fmt, arg)
}

func (log *Standard) CDebugf(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.internal.IsEnabledFor(logging.DEBUG) {
		log.Debug(log.prepareString(ctx, fmt), arg...)
	}
}

func (log *Standard) Info(fmt string, arg ...interface{}) {
	log.internal.Info(fmt, arg...)
	log.logToExternalLoggers(keybase1.LogLevel_INFO, fmt, arg)
}

func (log *Standard) CInfof(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.internal.IsEnabledFor(logging.INFO) {
		log.Info(log.prepareString(ctx, fmt), arg...)
	}
}

func (log *Standard) Notice(fmt string, arg ...interface{}) {
	log.internal.Notice(fmt, arg...)
	log.logToExternalLoggers(keybase1.LogLevel_NOTICE, fmt, arg)
}

func (log *Standard) CNoticef(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.internal.IsEnabledFor(logging.NOTICE) {
		log.Notice(log.prepareString(ctx, fmt), arg...)
	}
}

func (log *Standard) Warning(fmt string, arg ...interface{}) {
	log.internal.Warning(fmt, arg...)
	log.logToExternalLoggers(keybase1.LogLevel_WARN, fmt, arg)
}

func (log *Standard) CWarningf(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.internal.IsEnabledFor(logging.WARNING) {
		log.Warning(log.prepareString(ctx, fmt), arg...)
	}
}

func (log *Standard) Error(fmt string, arg ...interface{}) {
	log.internal.Error(fmt, arg...)
	log.logToExternalLoggers(keybase1.LogLevel_ERROR, fmt, arg)
}

func (log *Standard) Errorf(fmt string, arg ...interface{}) {
	log.Error(fmt, arg...)
}

func (log *Standard) CErrorf(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.internal.IsEnabledFor(logging.ERROR) {
		log.Error(log.prepareString(ctx, fmt), arg...)
	}
}

func (log *Standard) Critical(fmt string, arg ...interface{}) {
	log.internal.Critical(fmt, arg...)
	log.logToExternalLoggers(keybase1.LogLevel_CRITICAL, fmt, arg)
}

func (log *Standard) CCriticalf(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.internal.IsEnabledFor(logging.CRITICAL) {
		log.Critical(log.prepareString(ctx, fmt), arg...)
	}
}

func (log *Standard) Fatalf(fmt string, arg ...interface{}) {
	log.internal.Fatalf(fmt, arg...)
	log.logToExternalLoggers(keybase1.LogLevel_FATAL, fmt, arg)
}

func (log *Standard) CFatalf(ctx context.Context, fmt string,
	arg ...interface{}) {
	log.Fatalf(log.prepareString(ctx, fmt), arg...)
}

func (log *Standard) Profile(fmts string, arg ...interface{}) {
	log.Debug(fmts, arg...)
}

func (log *Standard) Configure(style string, debug bool, filename string) {
	log.configureMutex.Lock()
	defer log.configureMutex.Unlock()

	log.filename = filename

	var logfmt string
	if log.isTerminal {
		if debug {
			logfmt = fancyFormat
		} else {
			logfmt = defaultFormat
		}
	} else {
		logfmt = fileFormat
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
	dir, _ := filepath.Split(filename)
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

func (log *Standard) AddExternalLogger(externalLogger ExternalLogger) uint64 {
	log.externalLoggersMutex.Lock()
	defer log.externalLoggersMutex.Unlock()

	handle := log.externalLoggersCount
	log.externalLoggersCount++
	log.externalLoggers[handle] = externalLogger
	return handle
}

func (log *Standard) RemoveExternalLogger(handle uint64) {
	log.externalLoggersMutex.Lock()
	defer log.externalLoggersMutex.Unlock()

	delete(log.externalLoggers, handle)
	log.externalLoggersCount--
}

func (log *Standard) logToExternalLoggers(level keybase1.LogLevel, format string, args []interface{}) {
	if log.shutdown {
		return
	}
	e := entry{
		level:  level,
		format: format,
		args:   args,
	}

	// if buffer is full, don't block, just drop the log message
	select {
	case log.buffer <- &e:
		log.checkDropFlag()
	default:
		log.setDropFlag()
	}
}

// setDropFlag puts a flag into the drop channel if the channel is
// empty.  This is to signal that external log messages have been
// dropped.
func (log *Standard) setDropFlag() {
	select {
	case log.drop <- true:
	default:
	}
}

// checkDropFlag checks to see if anything is in the drop channel.
// If there is a flag in there, it will tell external loggers that
// log messages were dropped.
func (log *Standard) checkDropFlag() {
	select {
	case <-log.drop:
		log.buffer <- &entry{
			level:  keybase1.LogLevel_WARN,
			format: "Service log messages were dropped due to full buffer",
		}
	default:
	}
}

func (log *Standard) SetExternalLogLevel(level keybase1.LogLevel) {
	log.externalLoggersMutex.Lock()
	defer log.externalLoggersMutex.Unlock()

	log.externalLogLevel = level
}

func (log *Standard) processBuffer() {
	for e := range log.buffer {
		log.externalLoggersMutex.RLock()

		// Short circuit logs that are more verbose than the current external log
		// level.
		if e.level < log.externalLogLevel {
			log.externalLoggersMutex.RUnlock()
			continue
		}

		var wg sync.WaitGroup

		for _, externalLogger := range log.externalLoggers {
			wg.Add(1)
			go func(xl ExternalLogger) {
				xl.Log(e.level, e.format, e.args)
				wg.Done()
			}(externalLogger)
		}

		log.externalLoggersMutex.RUnlock()

		wg.Wait()
	}
}

func (log *Standard) Shutdown() {
	close(log.buffer)
	log.shutdown = true
}
