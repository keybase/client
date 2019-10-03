package logger

import (
	"golang.org/x/net/context"
)

type Context struct {
	ctx context.Context
	Logger
}

var _ ContextInterface = Context{}

func (c Context) Ctx() context.Context {
	return c.ctx
}

func NewContext(c context.Context, l Logger) Context {
	return Context{ctx: c, Logger: l}
}

func (c Context) UpdateContextToLoggerContext(ctx context.Context) ContextInterface {
	return NewContext(ctx, c.Logger)
}

func (c Context) Debug(format string, arg ...interface{}) {
	c.Logger.CloneWithAddedDepth(1).CDebugf(c.ctx, format, arg...)
}

func (c Context) Info(format string, arg ...interface{}) {
	c.Logger.CloneWithAddedDepth(1).CInfof(c.ctx, format, arg...)
}

func (c Context) Notice(format string, arg ...interface{}) {
	c.Logger.CloneWithAddedDepth(1).CNoticef(c.ctx, format, arg...)
}

func (c Context) Warning(format string, arg ...interface{}) {
	c.Logger.CloneWithAddedDepth(1).CWarningf(c.ctx, format, arg...)
}

func (c Context) Error(format string, arg ...interface{}) {
	c.Logger.CloneWithAddedDepth(1).CErrorf(c.ctx, format, arg...)
}

func (c Context) Critical(format string, arg ...interface{}) {
	c.Logger.CloneWithAddedDepth(1).CCriticalf(c.ctx, format, arg...)
}

func (c Context) Fatal(format string, arg ...interface{}) {
	c.Logger.CloneWithAddedDepth(1).CFatalf(c.ctx, format, arg...)
}
