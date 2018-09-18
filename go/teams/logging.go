package teams

import "golang.org/x/net/context"

type ctxKeyType string

const ctxKeySuppressLogging = ctxKeyType("sl")

func ShouldSuppressLogging(ctx context.Context) bool {
	v, _ := ctx.Value(ctxKeySuppressLogging).(bool)
	return v
}

func WithSuppressLogging(ctx context.Context, suppress bool) context.Context {
	return context.WithValue(ctx, ctxKeySuppressLogging, suppress)
}
