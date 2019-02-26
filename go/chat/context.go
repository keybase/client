package chat

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type appTypeSource interface {
	GetAppType() libkb.AppType
}

func IdentifyModeCtx(ctx context.Context, mode keybase1.TLFIdentifyBehavior,
	breaks *[]keybase1.TLFIdentifyFailure) context.Context {
	if mode == keybase1.TLFIdentifyBehavior_UNSET {
		mode = keybase1.TLFIdentifyBehavior_CHAT_CLI
	}
	return context.WithValue(ctx, types.IdentModeKey, types.IdentModeData{Mode: mode, Breaks: breaks})
}

func CtxKeyFinder(ctx context.Context, g *globals.Context) KeyFinder {
	var kf KeyFinder
	var ok bool
	val := ctx.Value(types.KfKey)
	if kf, ok = val.(KeyFinder); ok {
		return kf
	}
	return NewKeyFinder(g)
}

func CtxIdentifyNotifier(ctx context.Context) types.IdentifyNotifier {
	var in types.IdentifyNotifier
	var ok bool
	val := ctx.Value(types.InKey)
	if in, ok = val.(types.IdentifyNotifier); ok {
		return in
	}
	return nil
}

func CtxUPAKFinder(ctx context.Context, g *globals.Context) types.UPAKFinder {
	var up types.UPAKFinder
	var ok bool
	val := ctx.Value(types.UpKey)
	if up, ok = val.(types.UPAKFinder); ok {
		return up
	}
	return NewCachingUPAKFinder(g)
}

func CtxAddRateLimit(ctx context.Context, rl []chat1.RateLimit) {
	val := ctx.Value(types.RlKey)
	if existingRL, ok := val.(map[string]chat1.RateLimit); ok {
		for _, r := range rl {
			existingRL[r.Name] = r
		}
	}
}

func CtxRateLimits(ctx context.Context) (res []chat1.RateLimit) {
	val := ctx.Value(types.RlKey)
	if existingRL, ok := val.(map[string]chat1.RateLimit); ok {
		for _, rl := range existingRL {
			res = append(res, rl)
		}
	}
	return res
}

func CtxModifyIdentifyNotifier(ctx context.Context, notifier types.IdentifyNotifier) context.Context {
	return context.WithValue(ctx, types.InKey, notifier)
}

func CtxAddOverrideNameInfoSource(ctx context.Context, ni types.NameInfoSource) context.Context {
	return context.WithValue(ctx, types.NameInfoOverrideKey, ni)
}

func CtxAddLogTags(ctx context.Context, env appTypeSource) context.Context {

	// Add trace context value
	trace := libkb.RandStringB64(3)
	ctx = context.WithValue(ctx, types.ChatTraceKey, trace)

	// Add log tags
	ctx = libkb.WithLogTagWithValue(ctx, "chat-trace", trace)

	rpcTags := make(map[string]interface{})
	rpcTags["user-agent"] = libkb.UserAgent
	rpcTags["platform"] = libkb.GetPlatformString()
	rpcTags["apptype"] = env.GetAppType()
	ctx = rpc.AddRpcTagsToContext(ctx, rpcTags)

	return ctx
}

func CtxAddLocalizerCancelable(ctx context.Context) context.Context {
	return context.WithValue(ctx, types.LocalizerCancelableKey, true)
}

func Context(ctx context.Context, g *globals.Context, mode keybase1.TLFIdentifyBehavior,
	breaks *[]keybase1.TLFIdentifyFailure, notifier types.IdentifyNotifier) context.Context {
	if breaks == nil {
		breaks = new([]keybase1.TLFIdentifyFailure)
	}
	res := ctx
	_, _, ok := types.IdentifyMode(res)
	if !ok {
		res = IdentifyModeCtx(res, mode, breaks)
	}
	val := res.Value(types.KfKey)
	if _, ok := val.(KeyFinder); !ok {
		res = context.WithValue(res, types.KfKey, NewKeyFinder(g))
	}
	val = res.Value(types.InKey)
	if _, ok := val.(types.IdentifyNotifier); !ok {
		res = context.WithValue(res, types.InKey, notifier)
	}
	val = res.Value(types.UpKey)
	if _, ok := val.(types.UPAKFinder); !ok {
		res = context.WithValue(res, types.UpKey, NewCachingUPAKFinder(g))
	}
	val = res.Value(types.RlKey)
	if _, ok := val.(map[string]chat1.RateLimit); !ok {
		res = context.WithValue(res, types.RlKey, make(map[string]chat1.RateLimit))
	}
	if _, ok = types.CtxTrace(res); !ok {
		res = CtxAddLogTags(res, g.GetEnv())
	}
	return res
}

func BackgroundContext(sourceCtx context.Context, g *globals.Context) context.Context {

	rctx := libkb.CopyTagsToBackground(sourceCtx)

	in := CtxIdentifyNotifier(sourceCtx)
	if ident, breaks, ok := types.IdentifyMode(sourceCtx); ok {
		rctx = Context(rctx, g, ident, breaks, in)
	}

	// Overwrite trace tag
	if tr, ok := sourceCtx.Value(types.ChatTraceKey).(string); ok {
		rctx = context.WithValue(rctx, types.ChatTraceKey, tr)
	}

	if ni, ok := types.CtxOverrideNameInfoSource(sourceCtx); ok {
		rctx = CtxAddOverrideNameInfoSource(rctx, ni)
	}

	rctx = context.WithValue(rctx, types.KfKey, CtxKeyFinder(sourceCtx, g))
	rctx = context.WithValue(rctx, types.UpKey, CtxUPAKFinder(sourceCtx, g))
	rctx = context.WithValue(rctx, types.InKey, in)
	if types.IsLocalizerCancelableCtx(sourceCtx) {
		rctx = CtxAddLocalizerCancelable(rctx)
	}
	return rctx
}
