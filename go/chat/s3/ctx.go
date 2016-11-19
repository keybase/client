package s3

import "golang.org/x/net/context"

// ctxkey is for getting values out of context.Context
type ctxkey int

// fakeS3Key is the context key to determine if we're using the fakeS3 server.
const fakeS3Key ctxkey = 0

// NewFakeS3Context returns a context with the fakeS3Key flag set.
func NewFakeS3Context(ctx context.Context) context.Context {
	return context.WithValue(ctx, fakeS3Key, true)
}

func UsingFakeS3(ctx context.Context) bool {
	fake, ok := ctx.Value(fakeS3Key).(bool)
	if !ok {
		return false
	}
	return fake
}
