package logger

import (
	"testing"

	"golang.org/x/net/context"
)

type ContextAndLogger struct {
	ctx context.Context
	Logger
}

var _ CtxAndLogger = ContextAndLogger{}

func (c ContextAndLogger) Ctx() context.Context {
	return c.ctx
}

func NewContexAndLogger(c context.Context, l Logger) ContextAndLogger {
	return ContextAndLogger{ctx: c, Logger: l}
}

type loggerTypeKey string

func (c ContextAndLogger) UpdateContext(ctx context.Context) CtxAndLogger {
	return NewContexAndLogger(ctx, c.Logger)
}

func ExtractContextAndLoggerFromContext(c context.Context) ContextAndLogger {
	return NewContexAndLogger(c, c.Value(loggerTypeKey("")).(Logger))
}

func (c ContextAndLogger) Debug(format string, args ...interface{}) {
	c.Logger.CloneWithAddedDepth(1).CDebugf(c.ctx, format, args)
}

func (c ContextAndLogger) Info(format string, args ...interface{}) {
	c.Logger.CloneWithAddedDepth(1).CInfof(c.ctx, format, args)
}

func (c ContextAndLogger) Notice(format string, args ...interface{}) {
	c.Logger.CloneWithAddedDepth(1).CNoticef(c.ctx, format, args)
}

func (c ContextAndLogger) Warning(format string, args ...interface{}) {
	c.Logger.CloneWithAddedDepth(1).CWarningf(c.ctx, format, args)
}

func (c ContextAndLogger) Error(format string, args ...interface{}) {
	c.Logger.CloneWithAddedDepth(1).CErrorf(c.ctx, format, args)
}

func (c ContextAndLogger) Critical(format string, args ...interface{}) {
	c.Logger.CloneWithAddedDepth(1).CCriticalf(c.ctx, format, args)
}

func (c ContextAndLogger) Fatal(format string, args ...interface{}) {
	c.Logger.CloneWithAddedDepth(1).CFatalf(c.ctx, format, args)
}

func NewContextTodoWithLoggingForTesting(t *testing.T) CtxAndLogger {
	return &ContextAndLogger{ctx: context.TODO(), Logger: NewTestLogger(t)}
}
