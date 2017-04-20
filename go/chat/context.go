package chat

import (
	"context"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
)

type keyfinderKey int
type identifyNotifierKey int
type chatTrace int

var kfKey keyfinderKey
var inKey identifyNotifierKey
var chatTraceKey chatTrace

func CtxKeyFinder(ctx context.Context) KeyFinder {
	var kf KeyFinder
	var ok bool
	val := ctx.Value(kfKey)
	if kf, ok = val.(KeyFinder); ok {
		return kf
	}
	return NewKeyFinder()
}

func CtxIdentifyNotifier(ctx context.Context) *IdentifyNotifier {
	var in *IdentifyNotifier
	var ok bool
	val := ctx.Value(inKey)
	if in, ok = val.(*IdentifyNotifier); ok {
		return in
	}
	return nil
}

func CtxAddLogTags(ctx context.Context) context.Context {

	// Add trace context value
	ctx = context.WithValue(ctx, chatTraceKey, libkb.RandStringB64(3))

	// Add log tags
	tags := make(map[interface{}]string)
	tags[chatTraceKey] = "chat-trace"
	ctx = logger.NewContextWithLogTags(ctx, tags)

	return ctx
}

func Context(ctx context.Context, mode keybase1.TLFIdentifyBehavior,
	breaks *[]keybase1.TLFIdentifyFailure, notifier *IdentifyNotifier) context.Context {
	res := types.IdentifyModeCtx(ctx, mode, breaks)
	res = context.WithValue(res, kfKey, NewKeyFinder())
	res = context.WithValue(res, inKey, notifier)
	res = CtxAddLogTags(res)
	return res
}

func BackgroundContext(sourceCtx context.Context) context.Context {

	rctx := context.Background()

	in := CtxIdentifyNotifier(sourceCtx)
	if ident, breaks, ok := types.IdentifyMode(sourceCtx); ok {
		rctx = Context(rctx, ident, breaks, in)
	}

	// Overwrite trace tag
	if tr, ok := sourceCtx.Value(chatTraceKey).(string); ok {
		rctx = context.WithValue(rctx, chatTraceKey, tr)
	}

	rctx = context.WithValue(rctx, kfKey, CtxKeyFinder(sourceCtx))
	rctx = context.WithValue(rctx, inKey, in)

	return rctx
}
