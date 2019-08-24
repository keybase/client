package logger

import (
	"golang.org/x/net/context"
)

// SingleContextLogger logs everything in the same context. Useful for adding context-logging
// into code that doesn't yet support it.
type SingleContextLogger struct {
	ctx    context.Context
	logger Logger
}

func NewSingleContextLogger(ctx context.Context, l Logger) *SingleContextLogger {
	return &SingleContextLogger{ctx: ctx, logger: l}
}

var _ Logger = (*SingleContextLogger)(nil)

func (s *SingleContextLogger) Debug(format string, args ...interface{}) {
	s.logger.CloneWithAddedDepth(1).CDebugf(s.ctx, format, args...)
}
func (s *SingleContextLogger) CDebugf(ctx context.Context, format string, args ...interface{}) {
	s.logger.CloneWithAddedDepth(1).CDebugf(ctx, format, args...)
}
func (s *SingleContextLogger) Info(format string, args ...interface{}) {
	s.logger.CloneWithAddedDepth(1).CInfof(s.ctx, format, args...)
}
func (s *SingleContextLogger) CInfof(ctx context.Context, format string, args ...interface{}) {
	s.logger.CloneWithAddedDepth(1).CInfof(ctx, format, args...)
}
func (s *SingleContextLogger) Notice(format string, args ...interface{}) {
	s.logger.CloneWithAddedDepth(1).CNoticef(s.ctx, format, args...)
}
func (s *SingleContextLogger) CNoticef(ctx context.Context, format string, args ...interface{}) {
	s.logger.CloneWithAddedDepth(1).CNoticef(ctx, format, args...)
}
func (s *SingleContextLogger) Warning(format string, args ...interface{}) {
	s.logger.CloneWithAddedDepth(1).CWarningf(s.ctx, format, args...)
}
func (s *SingleContextLogger) CWarningf(ctx context.Context, format string, args ...interface{}) {
	s.logger.CloneWithAddedDepth(1).CWarningf(ctx, format, args...)
}
func (s *SingleContextLogger) Error(format string, args ...interface{}) {
	s.logger.CloneWithAddedDepth(1).CErrorf(s.ctx, format, args...)
}
func (s *SingleContextLogger) Errorf(format string, args ...interface{}) {
	s.logger.CloneWithAddedDepth(1).CErrorf(s.ctx, format, args...)
}
func (s *SingleContextLogger) CErrorf(ctx context.Context, format string, args ...interface{}) {
	s.logger.CloneWithAddedDepth(1).CErrorf(ctx, format, args...)
}
func (s *SingleContextLogger) Critical(format string, args ...interface{}) {
	s.logger.CloneWithAddedDepth(1).CCriticalf(s.ctx, format, args...)
}
func (s *SingleContextLogger) CCriticalf(ctx context.Context, format string, args ...interface{}) {
	s.logger.CloneWithAddedDepth(1).CCriticalf(ctx, format, args...)
}
func (s *SingleContextLogger) Fatalf(format string, args ...interface{}) {
	s.logger.CloneWithAddedDepth(1).CFatalf(s.ctx, format, args...)
}
func (s *SingleContextLogger) CFatalf(ctx context.Context, format string, args ...interface{}) {
	s.logger.CloneWithAddedDepth(1).CFatalf(ctx, format, args...)
}
func (s *SingleContextLogger) Profile(fmts string, arg ...interface{}) {
	s.logger.CloneWithAddedDepth(1).Profile(fmts, arg...)
}
func (s *SingleContextLogger) Configure(style string, debug bool, filename string) {
	s.logger.Configure(style, debug, filename)
}
func (s *SingleContextLogger) CloneWithAddedDepth(depth int) Logger {
	return &SingleContextLogger{
		ctx:    s.ctx,
		logger: s.logger.CloneWithAddedDepth(depth),
	}
}
func (s *SingleContextLogger) SetExternalHandler(handler ExternalHandler) {
	s.logger.SetExternalHandler(handler)
}
