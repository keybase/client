package log

import (
	"bytes"
	"context"
	"errors"
	"testing"

	"github.com/sirupsen/logrus"
	serr "github.com/stellar/go/support/errors"
	"github.com/stretchr/testify/assert"
)

func TestSet(t *testing.T) {
	assert.Nil(t, context.Background().Value(&loggerContextKey))
	l := New()
	ctx := Set(context.Background(), l)
	assert.Equal(t, l, ctx.Value(&loggerContextKey))
}

func TestCtx(t *testing.T) {
	// defaults to the default logger
	assert.Equal(t, DefaultLogger, Ctx(context.Background()))

	// a set value overrides the default
	l := New()
	ctx := Set(context.Background(), l)
	assert.Equal(t, l, Ctx(ctx))

	// the deepest set value is returns
	nested := New()
	nctx := Set(ctx, nested)
	assert.Equal(t, nested, Ctx(nctx))
}

func TestPushCtx(t *testing.T) {

	output := new(bytes.Buffer)
	l := New()
	l.Logger.Formatter.(*logrus.TextFormatter).DisableColors = true
	l.Logger.Out = output
	ctx := Set(context.Background(), l.WithField("foo", "bar"))

	Ctx(ctx).Warn("hello")
	assert.Contains(t, output.String(), "foo=bar")
	assert.NotContains(t, output.String(), "foo=baz")

	ctx = PushContext(ctx, func(logger *Entry) *Entry {
		return logger.WithField("foo", "baz")
	})

	Ctx(ctx).Warn("hello")
	assert.Contains(t, output.String(), "foo=baz")
}

func TestLoggingStatements(t *testing.T) {
	output := new(bytes.Buffer)
	l := New()
	l.Logger.Formatter.(*logrus.TextFormatter).DisableColors = true
	l.Logger.Out = output

	// level defaults to warn
	l.Debug("debug")
	l.Info("info")
	l.Warn("warn")

	assert.NotContains(t, output.String(), "level=info")
	assert.NotContains(t, output.String(), "level=debug")
	assert.Contains(t, output.String(), "level=warn")

	// when on debug level, all statements are logged
	output.Reset()
	assert.Empty(t, output.String())
	l.Logger.Level = logrus.DebugLevel
	l.Debug("1")
	l.Info("1")
	l.Warn("1")
	l.Error("1")
	assert.Contains(t, output.String(), "level=debug")
	assert.Contains(t, output.String(), "level=info")
	assert.Contains(t, output.String(), "level=warn")
	assert.Contains(t, output.String(), "level=error")
	assert.Panics(t, func() {
		l.Panic("boom")
	}, "Calling Panic() should panic")
	assert.Contains(t, output.String(), "level=panic")
}

func TestWithStack(t *testing.T) {
	output := new(bytes.Buffer)
	l := New()
	l.Logger.Formatter.(*logrus.TextFormatter).DisableColors = true
	l.Logger.Out = output

	// Adds stack=unknown when the provided err has not stack info
	l.WithStack(errors.New("broken")).Error("test")
	assert.Contains(t, output.String(), "stack=unknown")

	// Adds the stack properly if a go-errors.Error is provided
	err := serr.New("broken")
	l.WithStack(err).Error("test")
	// simply ensure that the line creating the above error is in the log
	assert.Contains(t, output.String(), "main_test.go:")
}
