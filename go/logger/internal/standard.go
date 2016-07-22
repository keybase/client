// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package internal

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	logging "github.com/keybase/go-logging"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/logger"
)

const permDir os.FileMode = 0700

// Map from module name to whether SetLevel() has been called for that
// module.
var initLoggingSetLevelCalled = map[string]struct{}{}

// Protects access to initLoggingSetLevelCalled and the actual
// SetLevel call.
var initLoggingSetLevelMutex sync.Mutex

// CtxStandardLoggerKey is a type defining context keys used by the
// Standard logger.
type CtxStandardLoggerKey int

const (
	// CtxLogTagsKey defines a context key that can associate with a map of
	// context keys (key -> descriptive-name), the mapped values of which should
	// be logged by a Standard logger if one of those keys is seen in a context
	// during a log call.
	CtxLogTagsKey CtxStandardLoggerKey = iota
)

type CtxLogTags map[interface{}]string

// NewContext returns a new Context that carries adds the given log
// tag mappings (context key -> display string).
func NewContextWithLogTags(
	ctx context.Context, logTagsToAdd CtxLogTags) context.Context {
	currTags, _ := LogTagsFromContext(ctx)
	newTags := make(CtxLogTags)
	// Make a copy to avoid races
	for key, tag := range currTags {
		newTags[key] = tag
	}
	for key, tag := range logTagsToAdd {
		newTags[key] = tag
	}
	return context.WithValue(ctx, CtxLogTagsKey, newTags)
}

// LogTagsFromContext returns the log tags being passed along with the
// given context.
func LogTagsFromContext(ctx context.Context) (CtxLogTags, bool) {
	logTags, ok := ctx.Value(CtxLogTagsKey).(CtxLogTags)
	return logTags, ok
}

type entry struct {
	level  logger.LogLevel
	format string
	args   []interface{}
}

type Standard interface {
	Logger
	logger.Forwarder
	logger.LogFileRotater
	logger.Configurable
}

type standard struct {
	internal       *logging.Logger
	filename       string
	configureMutex sync.Mutex
	module         string

	externalHandler logger.LogHandler
}

// Verify Standard fully implements the Logger interface.
var _ Standard = (*standard)(nil)

// New creates a new Standard logger for module.
func New(module string) Standard {
	return NewWithCallDepth(module, 0)
}

// NewWithCallDepth creates a new Standard logger for module, and when
// printing file names and line numbers, it goes extraCallDepth up the
// stack from where logger was invoked.
func NewWithCallDepth(module string, extraCallDepth int) Standard {
	log := logging.MustGetLogger(module)
	log.ExtraCalldepth = 1 + extraCallDepth

	ret := &standard{
		internal: log,
		module:   module,
	}
	ret.setLogLevelInfo()
	return ret
}

func (log *standard) setLogLevelInfo() {
	initLoggingSetLevelMutex.Lock()
	defer initLoggingSetLevelMutex.Unlock()

	if _, found := initLoggingSetLevelCalled[log.module]; !found {
		logging.SetLevel(logging.INFO, log.module)
		initLoggingSetLevelCalled[log.module] = struct{}{}
	}
}

func prepareString(
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

func (log *standard) Debugf(fmt string, arg ...interface{}) {
	log.internal.Debugf(fmt, arg...)
	if log.externalHandler != nil {
		log.externalHandler.Log(logger.DEBUG, fmt, arg)
	}
}

func (log *standard) CDebugf(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.internal.IsEnabledFor(logging.DEBUG) {
		log.Debugf(prepareString(ctx, fmt), arg...)
	}
}

func (log *standard) Infof(fmt string, arg ...interface{}) {
	log.internal.Infof(fmt, arg...)
	if log.externalHandler != nil {
		log.externalHandler.Log(logger.INFO, fmt, arg)
	}
}

func (log *standard) CInfof(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.internal.IsEnabledFor(logging.INFO) {
		log.Infof(prepareString(ctx, fmt), arg...)
	}
}

func (log *standard) Noticef(fmt string, arg ...interface{}) {
	log.internal.Noticef(fmt, arg...)
	if log.externalHandler != nil {
		log.externalHandler.Log(logger.NOTICE, fmt, arg)
	}
}

func (log *standard) CNoticef(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.internal.IsEnabledFor(logging.NOTICE) {
		log.Noticef(prepareString(ctx, fmt), arg...)
	}
}

func (log *standard) Warningf(fmt string, arg ...interface{}) {
	log.internal.Warningf(fmt, arg...)
	if log.externalHandler != nil {
		log.externalHandler.Log(logger.WARN, fmt, arg)
	}
}

func (log *standard) CWarningf(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.internal.IsEnabledFor(logging.WARNING) {
		log.Warningf(prepareString(ctx, fmt), arg...)
	}
}

func (log *standard) Errorf(fmt string, arg ...interface{}) {
	log.internal.Errorf(fmt, arg...)
	if log.externalHandler != nil {
		log.externalHandler.Log(logger.ERROR, fmt, arg)
	}
}

func (log *standard) CErrorf(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.internal.IsEnabledFor(logging.ERROR) {
		log.Errorf(prepareString(ctx, fmt), arg...)
	}
}

func (log *standard) Criticalf(fmt string, arg ...interface{}) {
	log.internal.Criticalf(fmt, arg...)
	if log.externalHandler != nil {
		log.externalHandler.Log(logger.CRITICAL, fmt, arg)
	}
}

func (log *standard) CCriticalf(ctx context.Context, fmt string,
	arg ...interface{}) {
	if log.internal.IsEnabledFor(logging.CRITICAL) {
		log.Criticalf(prepareString(ctx, fmt), arg...)
	}
}

func (log *standard) Fatalf(fmt string, arg ...interface{}) {
	log.internal.Fatalf(fmt, arg...)
	if log.externalHandler != nil {
		log.externalHandler.Log(logger.FATAL, fmt, arg)
	}
}

func (log *standard) CFatalf(ctx context.Context, fmt string,
	arg ...interface{}) {
	log.Fatalf(prepareString(ctx, fmt), arg...)
}

// Configure sets the style of the log file, whether debugging (verbose)
// is enabled and a filename. If a filename is provided here it will
// be used for logging straight away (this is a new feature).
// SetLogFileConfig provides a way to set the log file with more control on rotation.
func (log *standard) Configure(style string, debug bool, filename string) {
	log.configureMutex.Lock()
	defer log.configureMutex.Unlock()

	log.filename = filename

	var logfmt string

	globalLock.Lock()
	isTerm := stderrIsTerminal
	globalLock.Unlock()

	// TODO: how should setting the log file after a Configure be handled?
	if isTerm {
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
	// If passed a plain file name as a path
	if dir == "" {
		return nil
	}
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

func (log *standard) CloneWithAddedDepth(depth int) Logger {
	clone := *log
	cloneInternal := *log.internal
	cloneInternal.ExtraCalldepth = log.internal.ExtraCalldepth + depth
	clone.internal = &cloneInternal
	return &clone
}

func (log *standard) SetExternalHandler(handler logger.LogHandler) {
	log.externalHandler = handler
}

type UnforwardedLogger interface {
	logger.FLogger
}

func (log *standard) GetUnforwardedLogger() UnforwardedLogger {
	return log.internal
}
