package teams

import "golang.org/x/net/context"

type ctxKeyType string

const ctxKeySuppressLogging = ctxKeyType("sl")

func ShouldSuppressLogging(ctx context.Context) bool {
	return false
}

func WithSuppressLogging(ctx context.Context, suppress bool) context.Context {
	return context.WithValue(ctx, ctxKeySuppressLogging, suppress)
}
