package logger

import (
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

type Logger interface {
	// Debug logs a message at debug level, with formatting args.
	Debug(format string, args ...interface{})
	// CDebugf logs a message at debug level, with a context and
	// formatting args.
	CDebugf(ctx context.Context, format string, args ...interface{})
	// Info logs a message at info level, with formatting args.
	Info(format string, args ...interface{})
	// CInfo logs a message at info level, with a context and formatting args.
	CInfof(ctx context.Context, format string, args ...interface{})
	// Notice logs a message at notice level, with formatting args.
	Notice(format string, args ...interface{})
	// CNoticef logs a message at notice level, with a context and
	// formatting args.
	CNoticef(ctx context.Context, format string, args ...interface{})
	// Warning logs a message at warning level, with formatting args.
	Warning(format string, args ...interface{})
	// CWarning logs a message at warning level, with a context and
	// formatting args.
	CWarningf(ctx context.Context, format string, args ...interface{})
	// Error logs a message at error level, with formatting args
	Error(format string, args ...interface{})
	// Errorf logs a message at error level, with formatting args.
	Errorf(format string, args ...interface{})
	// CErrorf logs a message at error level, with a context and
	// formatting args.
	CErrorf(ctx context.Context, format string, args ...interface{})
	// Critical logs a message at critical level, with formatting args.
	Critical(format string, args ...interface{})
	// CCriticalf logs a message at critical level, with a context and
	// formatting args.
	CCriticalf(ctx context.Context, format string, args ...interface{})
	// Fatalf logs a message at fatal level, with formatting args.
	Fatalf(format string, args ...interface{})
	// Fatalf logs a message at fatal level, with a context and formatting args.
	CFatalf(ctx context.Context, format string, args ...interface{})
	// Profile logs a profile message, with formatting args.
	Profile(fmts string, arg ...interface{})
	// Configure sets the style, debug level, and filename of the
	// logger.  Output isn't redirected to the file until
	// RotateLogFile is called for the first time.
	Configure(style string, debug bool, filename string)
	// RotateLogFile rotates the log file, if the underlying logger is
	// writing to a file.
	RotateLogFile() error

	// External loggers are a hack to allow the calls to G.Log.* in the daemon
	// to be forwarded to the client. Loggers are registered here with
	// AddExternalLogger when connections are started, and every log that's
	// done gets replayed for each external logger registered at the time. That
	// will cause some duplication when multiple clients are connected, but
	// it's a hack. Ideally in the future every function that needs to log will
	// have a context.
	//
	// Because external loggers are intended to be talking over the RPC
	// connection, we don't want to push all the voluminous debug logs unless
	// the client actually wants them. Thus we keep a log level here, and we
	// drop any logs that are below that level. Clients will set this over RPC
	// when they connect.
	AddExternalLogger(externalLogger ExternalLogger) uint64
	RemoveExternalLogger(handle uint64)
	SetLogLevel(level keybase1.LogLevel)
}
