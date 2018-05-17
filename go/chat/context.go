package chat

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type appTypeSource interface {
	GetAppType() libkb.AppType
}

type keyfinderKey int
type identifyNotifierKey int
type chatTrace int
type identifyModeKey int
type upakfinderKey int
type rateLimitKey int

var kfKey keyfinderKey
var inKey identifyNotifierKey
var chatTraceKey chatTrace
var identModeKey identifyModeKey
var upKey upakfinderKey
var rlKey rateLimitKey

type identModeData struct {
	mode   keybase1.TLFIdentifyBehavior
	breaks *[]keybase1.TLFIdentifyFailure
}

func IdentifyModeCtx(ctx context.Context, mode keybase1.TLFIdentifyBehavior,
	breaks *[]keybase1.TLFIdentifyFailure) context.Context {
	if mode == keybase1.TLFIdentifyBehavior_UNSET {
		mode = keybase1.TLFIdentifyBehavior_CHAT_CLI
	}
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

func CtxKeyFinder(ctx context.Context, g *globals.Context) KeyFinder {
	var kf KeyFinder
	var ok bool
	val := ctx.Value(kfKey)
	if kf, ok = val.(KeyFinder); ok {
		return kf
	}
	return NewKeyFinder(g)
}

func CtxIdentifyNotifier(ctx context.Context) types.IdentifyNotifier {
	var in types.IdentifyNotifier
	var ok bool
	val := ctx.Value(inKey)
	if in, ok = val.(types.IdentifyNotifier); ok {
		return in
	}
	return nil
}

func CtxUPAKFinder(ctx context.Context, g *globals.Context) types.UPAKFinder {
	var up types.UPAKFinder
	var ok bool
	val := ctx.Value(upKey)
	if up, ok = val.(types.UPAKFinder); ok {
		return up
	}
	return NewCachingUPAKFinder(g)
}

func CtxAddRateLimit(ctx context.Context, rl []chat1.RateLimit) {
	val := ctx.Value(rlKey)
	if existingRL, ok := val.(map[string]chat1.RateLimit); ok {
		for _, r := range rl {
			existingRL[r.Name] = r
		}
	}
}

func CtxRateLimits(ctx context.Context) (res []chat1.RateLimit) {
	val := ctx.Value(rlKey)
	if existingRL, ok := val.(map[string]chat1.RateLimit); ok {
		for _, rl := range existingRL {
			res = append(res, rl)
		}
	}
	return res
}

func CtxModifyIdentifyNotifier(ctx context.Context, notifier types.IdentifyNotifier) context.Context {
	return context.WithValue(ctx, inKey, notifier)
}

func CtxTrace(ctx context.Context) (string, bool) {
	var trace string
	var ok bool
	val := ctx.Value(chatTraceKey)
	if trace, ok = val.(string); ok {
		return trace, true
	}
	return "", false
}

func CtxAddLogTags(ctx context.Context, env appTypeSource) context.Context {

	// Add trace context value
	ctx = context.WithValue(ctx, chatTraceKey, libkb.RandStringB64(3))

	// Add log tags
	tags := make(map[interface{}]string)
	tags[chatTraceKey] = "chat-trace"
	ctx = logger.NewContextWithLogTags(ctx, tags)

	rpcTags := make(map[string]interface{})
	rpcTags["user-agent"] = libkb.UserAgent
	rpcTags["platform"] = libkb.GetPlatformString()
	rpcTags["apptype"] = env.GetAppType()
	ctx = rpc.AddRpcTagsToContext(ctx, rpcTags)

	return ctx
}

func Context(ctx context.Context, g *globals.Context, mode keybase1.TLFIdentifyBehavior,
	breaks *[]keybase1.TLFIdentifyFailure, notifier types.IdentifyNotifier) context.Context {
	if breaks == nil {
		breaks = new([]keybase1.TLFIdentifyFailure)
	}
	res := ctx
	_, _, ok := IdentifyMode(res)
	if !ok {
		res = IdentifyModeCtx(res, mode, breaks)
	}
	val := res.Value(kfKey)
	if _, ok := val.(KeyFinder); !ok {
		res = context.WithValue(res, kfKey, NewKeyFinder(g))
	}
	val = res.Value(inKey)
	if _, ok := val.(types.IdentifyNotifier); !ok {
		res = context.WithValue(res, inKey, notifier)
	}
	val = res.Value(upKey)
	if _, ok := val.(types.UPAKFinder); !ok {
		res = context.WithValue(res, upKey, NewCachingUPAKFinder(g))
	}
	val = res.Value(rlKey)
	if _, ok := val.(map[string]chat1.RateLimit); !ok {
		res = context.WithValue(res, rlKey, make(map[string]chat1.RateLimit))
	}
	if _, ok = CtxTrace(res); !ok {
		res = CtxAddLogTags(res, g.GetEnv())
	}
	return res
}

func BackgroundContext(sourceCtx context.Context, g *globals.Context) context.Context {

	rctx := context.Background()

	in := CtxIdentifyNotifier(sourceCtx)
	if ident, breaks, ok := IdentifyMode(sourceCtx); ok {
		rctx = Context(rctx, g, ident, breaks, in)
	}

	// Overwrite trace tag
	if tr, ok := sourceCtx.Value(chatTraceKey).(string); ok {
		rctx = context.WithValue(rctx, chatTraceKey, tr)
	}

	rctx = context.WithValue(rctx, kfKey, CtxKeyFinder(sourceCtx, g))
	rctx = context.WithValue(rctx, upKey, CtxUPAKFinder(sourceCtx, g))
	rctx = context.WithValue(rctx, inKey, in)

	return rctx
}
