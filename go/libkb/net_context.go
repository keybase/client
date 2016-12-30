package libkb

import (
	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

type withLogTagKey string

func WithLogTag(ctx context.Context, k string) context.Context {
	addLogTags := true
	tagKey := withLogTagKey(k)

	if tags, ok := logger.LogTagsFromContext(ctx); ok {
		if _, found := tags[tagKey]; found {
			addLogTags = false
		}
	}

	if addLogTags {
		newTags := make(logger.CtxLogTags)
		newTags[tagKey] = k
		ctx = logger.NewContextWithLogTags(ctx, newTags)
	}

	if _, found := ctx.Value(tagKey).(withLogTagKey); !found {
		tag := RandStringB64(3)
		ctx = context.WithValue(ctx, tagKey, tag)
	}
	return ctx
}
