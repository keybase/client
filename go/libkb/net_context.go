package libkb

import (
	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

func WithLogTag(ctx context.Context, k string) context.Context {
	addLogTags := true
	if tags, ok := logger.LogTagsFromContext(ctx); ok {
		if _, found := tags[k]; found {
			addLogTags = false
		}
	}
	if addLogTags {
		newTags := make(logger.CtxLogTags)
		newTags[k] = k
		ctx = logger.NewContextWithLogTags(ctx, newTags)
	}

	if _, found := ctx.Value(k).(string); !found {
		tag := RandStringB64(3)
		ctx = context.WithValue(ctx, k, tag)
	}
	return ctx
}
