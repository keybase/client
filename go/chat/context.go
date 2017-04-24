package chat

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
)

type keyfinderKey int
type identifyNotifierKey int
type chatTrace int
type identifyModeKey int

var kfKey keyfinderKey
var inKey identifyNotifierKey
var chatTraceKey chatTrace
var identModeKey identifyModeKey

type identModeData struct {
	mode   keybase1.TLFIdentifyBehavior
	breaks *[]keybase1.TLFIdentifyFailure
}

func IdentifyModeCtx(ctx context.Context, mode keybase1.TLFIdentifyBehavior,
	breaks *[]keybase1.TLFIdentifyFailure) context.Context {
	return context.WithValue(ctx, identModeKey, identModeData{mode: mode, breaks: breaks})
}

func IdentifyMode(ctx context.Context) (ib keybase1.TLFIdentifyBehavior, breaks *[]keybase1.TLFIdentifyFailure, ok bool) {
	var imd identModeData
	val := ctx.Value(identModeKey)
	if imd, ok = val.(identModeData); ok {
		return imd.mode, imd.breaks, ok
	}
	return keybase1.TLFIdentifyBehavior_CHAT_CLI, nil, false
}

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
	res := IdentifyModeCtx(ctx, mode, breaks)
	res = context.WithValue(res, kfKey, NewKeyFinder())
	res = context.WithValue(res, inKey, notifier)
	res = CtxAddLogTags(res)
	return res
}

func BackgroundContext(sourceCtx context.Context) context.Context {

	rctx := context.Background()

	in := CtxIdentifyNotifier(sourceCtx)
	if ident, breaks, ok := IdentifyMode(sourceCtx); ok {
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
