package globals

import (
	"context"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type keyfinderKey int
type identifyNotifierKey int
type chatTrace int
type identifyModeKey int
type upakfinderKey int
type rateLimitKey int
type nameInfoOverride int
type localizerCancelableKeyTyp int
type messageSkipsKeyTyp int
type unboxModeKeyTyp int

var kfKey keyfinderKey
var inKey identifyNotifierKey
var chatTraceKey chatTrace
var identModeKey identifyModeKey
var upKey upakfinderKey
var rlKey rateLimitKey
var nameInfoOverrideKey nameInfoOverride
var localizerCancelableKey localizerCancelableKeyTyp
var messageSkipsKey messageSkipsKeyTyp
var unboxModeKey unboxModeKeyTyp

type identModeData struct {
	mode   keybase1.TLFIdentifyBehavior
	breaks *[]keybase1.TLFIdentifyFailure
}

func CtxKeyFinder(ctx context.Context, g *Context) types.KeyFinder {
	var kf types.KeyFinder
	var ok bool
	val := ctx.Value(kfKey)
	if kf, ok = val.(types.KeyFinder); ok {
		return kf
	}
	return g.CtxFactory.NewKeyFinder()
}

func CtxUPAKFinder(ctx context.Context, g *Context) types.UPAKFinder {
	var up types.UPAKFinder
	var ok bool
	val := ctx.Value(upKey)
	if up, ok = val.(types.UPAKFinder); ok {
		return up
	}
	return g.CtxFactory.NewUPAKFinder()
}

func CtxIdentifyMode(ctx context.Context) (ib keybase1.TLFIdentifyBehavior, breaks *[]keybase1.TLFIdentifyFailure, ok bool) {
	var imd identModeData
	val := ctx.Value(identModeKey)
	if imd, ok = val.(identModeData); ok {
		return imd.mode, imd.breaks, ok
	}
	return keybase1.TLFIdentifyBehavior_CHAT_CLI, nil, false
}

func CtxAddIdentifyMode(ctx context.Context, mode keybase1.TLFIdentifyBehavior,
	breaks *[]keybase1.TLFIdentifyFailure) context.Context {
	if mode == keybase1.TLFIdentifyBehavior_UNSET {
		mode = keybase1.TLFIdentifyBehavior_CHAT_CLI
	}
	return context.WithValue(ctx, identModeKey, identModeData{mode: mode, breaks: breaks})
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

func CtxModifyIdentifyNotifier(ctx context.Context, notifier types.IdentifyNotifier) context.Context {
	return context.WithValue(ctx, inKey, notifier)
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

func CtxAddMessageCacheSkips(ctx context.Context, convID chat1.ConversationID, msgs []chat1.MessageUnboxed) {
	val := ctx.Value(messageSkipsKey)
	if existingSkips, ok := val.(map[string]MessageCacheSkip); ok {
		existingSkips[convID.String()] = MessageCacheSkip{
			ConvID: convID,
			Msgs:   append(existingSkips[convID.String()].Msgs, msgs...),
		}
	}
}

type MessageCacheSkip struct {
	ConvID chat1.ConversationID
	Msgs   []chat1.MessageUnboxed
}

func CtxMessageCacheSkips(ctx context.Context) (res []MessageCacheSkip) {
	val := ctx.Value(messageSkipsKey)
	if existingSkips, ok := val.(map[string]MessageCacheSkip); ok {
		for _, skips := range existingSkips {
			res = append(res, skips)
		}
	}
	return res
}

func CtxModifyUnboxMode(ctx context.Context, unboxMode types.UnboxMode) context.Context {
	return context.WithValue(ctx, unboxModeKey, unboxMode)
}

func CtxUnboxMode(ctx context.Context) types.UnboxMode {
	val := ctx.Value(unboxModeKey)
	if unboxMode, ok := val.(types.UnboxMode); ok {
		return unboxMode
	}
	return types.UnboxModeFull
}

func CtxOverrideNameInfoSource(ctx context.Context) (types.NameInfoSource, bool) {
	val := ctx.Value(nameInfoOverrideKey)
	if ni, ok := val.(types.NameInfoSource); ok {
		return ni, true
	}
	return nil, false
}

func CtxAddOverrideNameInfoSource(ctx context.Context, ni types.NameInfoSource) context.Context {
	return context.WithValue(ctx, nameInfoOverrideKey, ni)
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

func CtxAddLogTags(ctx context.Context, g *Context) context.Context {

	// Add trace context value
	trace := libkb.RandStringB64(3)
	ctx = context.WithValue(ctx, chatTraceKey, trace)

	// Add log tags
	ctx = libkb.WithLogTagWithValue(ctx, "chat-trace", trace)

	rpcTags := make(map[string]interface{})
	rpcTags["user-agent"] = libkb.UserAgent
	rpcTags["platform"] = libkb.GetPlatformString()
	rpcTags["apptype"] = g.GetAppType()
	ctx = rpc.AddRpcTagsToContext(ctx, rpcTags)

	return ctx
}

func IsLocalizerCancelableCtx(ctx context.Context) bool {
	val := ctx.Value(localizerCancelableKey)
	if bval, ok := val.(bool); ok && bval {
		return true
	}
	return false
}

func CtxAddLocalizerCancelable(ctx context.Context) context.Context {
	return context.WithValue(ctx, localizerCancelableKey, true)
}

func CtxRemoveLocalizerCancelable(ctx context.Context) context.Context {
	if IsLocalizerCancelableCtx(ctx) {
		return context.WithValue(ctx, localizerCancelableKey, false)
	}
	return ctx
}

func ChatCtx(ctx context.Context, g *Context, mode keybase1.TLFIdentifyBehavior,
	breaks *[]keybase1.TLFIdentifyFailure, notifier types.IdentifyNotifier) context.Context {
	if breaks == nil {
		breaks = new([]keybase1.TLFIdentifyFailure)
	}
	res := ctx
	if _, _, ok := CtxIdentifyMode(res); !ok {
		res = CtxAddIdentifyMode(res, mode, breaks)
	}
	val := res.Value(kfKey)
	if _, ok := val.(types.KeyFinder); !ok {
		res = context.WithValue(res, kfKey, g.CtxFactory.NewKeyFinder())
	}
	val = res.Value(inKey)
	if _, ok := val.(types.IdentifyNotifier); !ok {
		res = context.WithValue(res, inKey, notifier)
	}
	val = res.Value(upKey)
	if _, ok := val.(types.UPAKFinder); !ok {
		res = context.WithValue(res, upKey, g.CtxFactory.NewUPAKFinder())
	}
	val = res.Value(rlKey)
	if _, ok := val.(map[string]chat1.RateLimit); !ok {
		res = context.WithValue(res, rlKey, make(map[string]chat1.RateLimit))
	}
	val = res.Value(messageSkipsKey)
	if _, ok := val.(map[string]MessageCacheSkip); !ok {
		res = context.WithValue(res, messageSkipsKey, make(map[string]MessageCacheSkip))
	}
	val = res.Value(unboxModeKey)
	if _, ok := val.(types.UnboxMode); !ok {
		res = context.WithValue(res, unboxModeKey, types.UnboxModeFull)
	}
	if _, ok := CtxTrace(res); !ok {
		res = CtxAddLogTags(res, g)
	}
	return res
}

func BackgroundChatCtx(sourceCtx context.Context, g *Context) context.Context {

	rctx := libkb.CopyTagsToBackground(sourceCtx)

	in := CtxIdentifyNotifier(sourceCtx)
	if ident, breaks, ok := CtxIdentifyMode(sourceCtx); ok {
		rctx = ChatCtx(rctx, g, ident, breaks, in)
	}

	// Overwrite trace tag
	if tr, ok := sourceCtx.Value(chatTraceKey).(string); ok {
		rctx = context.WithValue(rctx, chatTraceKey, tr)
	}

	if ni, ok := CtxOverrideNameInfoSource(sourceCtx); ok {
		rctx = CtxAddOverrideNameInfoSource(rctx, ni)
	}
	rctx = context.WithValue(rctx, kfKey, CtxKeyFinder(sourceCtx, g))
	rctx = context.WithValue(rctx, upKey, CtxUPAKFinder(sourceCtx, g))
	rctx = context.WithValue(rctx, inKey, in)
	if IsLocalizerCancelableCtx(sourceCtx) {
		rctx = CtxAddLocalizerCancelable(rctx)
	}
	return rctx
}
