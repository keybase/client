package globals

import (
	"context"
	"sync"

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
type emojiHarvesterKeyTyp int
type ctxMutexKeyTyp int

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
var emojiHarvesterKey emojiHarvesterKeyTyp
var ctxMutexKey ctxMutexKeyTyp

type identModeData struct {
	mode   keybase1.TLFIdentifyBehavior
	breaks *[]keybase1.TLFIdentifyFailure
}

func CtxKeyFinder(ctx context.Context, g *Context) types.KeyFinder {
	if kf, ok := ctx.Value(kfKey).(types.KeyFinder); ok {
		return kf
	}
	return g.CtxFactory.NewKeyFinder()
}

func CtxUPAKFinder(ctx context.Context, g *Context) types.UPAKFinder {
	if up, ok := ctx.Value(upKey).(types.UPAKFinder); ok {
		return up
	}
	return g.CtxFactory.NewUPAKFinder()
}

func CtxIdentifyMode(ctx context.Context) (ib keybase1.TLFIdentifyBehavior, breaks *[]keybase1.TLFIdentifyFailure, ok bool) {
	if imd, ok := ctx.Value(identModeKey).(identModeData); ok {
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
	if in, ok := ctx.Value(inKey).(types.IdentifyNotifier); ok {
		return in
	}
	return nil
}

func CtxModifyIdentifyNotifier(ctx context.Context, notifier types.IdentifyNotifier) context.Context {
	return context.WithValue(ctx, inKey, notifier)
}

func CtxAddRateLimit(ctx context.Context, rl []chat1.RateLimit) {
	if l, ok := ctx.Value(ctxMutexKey).(*sync.RWMutex); ok {
		l.Lock()
		defer l.Unlock()
		if existingRL, ok := ctx.Value(rlKey).(map[string]chat1.RateLimit); ok {
			for _, r := range rl {
				existingRL[r.Name] = r
			}
		}
	}
}

func CtxRateLimits(ctx context.Context) (res []chat1.RateLimit) {
	if l, ok := ctx.Value(ctxMutexKey).(*sync.RWMutex); ok {
		l.RLock()
		defer l.RUnlock()
		if existingRL, ok := ctx.Value(rlKey).(map[string]chat1.RateLimit); ok {
			for _, rl := range existingRL {
				res = append(res, rl)
			}
		}
	}
	return res
}

func CtxAddMessageCacheSkips(ctx context.Context, convID chat1.ConversationID, msgs []chat1.MessageUnboxed) {
	if l, ok := ctx.Value(ctxMutexKey).(*sync.RWMutex); ok {
		l.Lock()
		defer l.Unlock()
		if existingSkips, ok := ctx.Value(messageSkipsKey).(map[chat1.ConvIDStr]MessageCacheSkip); ok {
			existingSkips[convID.ConvIDStr()] = MessageCacheSkip{
				ConvID: convID,
				Msgs:   append(existingSkips[convID.ConvIDStr()].Msgs, msgs...),
			}
		}
	}
}

type MessageCacheSkip struct {
	ConvID chat1.ConversationID
	Msgs   []chat1.MessageUnboxed
}

func CtxMessageCacheSkips(ctx context.Context) (res []MessageCacheSkip) {
	if l, ok := ctx.Value(ctxMutexKey).(*sync.RWMutex); ok {
		l.RLock()
		defer l.RUnlock()
		if existingSkips, ok := ctx.Value(messageSkipsKey).(map[chat1.ConvIDStr]MessageCacheSkip); ok {
			for _, skips := range existingSkips {
				res = append(res, skips)
			}
		}
	}
	return res
}

func CtxModifyUnboxMode(ctx context.Context, unboxMode types.UnboxMode) context.Context {
	return context.WithValue(ctx, unboxModeKey, unboxMode)
}

func CtxUnboxMode(ctx context.Context) types.UnboxMode {
	if unboxMode, ok := ctx.Value(unboxModeKey).(types.UnboxMode); ok {
		return unboxMode
	}
	return types.UnboxModeFull
}

func CtxOverrideNameInfoSource(ctx context.Context) (types.NameInfoSource, bool) {
	if ni, ok := ctx.Value(nameInfoOverrideKey).(types.NameInfoSource); ok {
		return ni, true
	}
	return nil, false
}

func CtxAddOverrideNameInfoSource(ctx context.Context, ni types.NameInfoSource) context.Context {
	return context.WithValue(ctx, nameInfoOverrideKey, ni)
}

func CtxTrace(ctx context.Context) (string, bool) {
	if trace, ok := ctx.Value(chatTraceKey).(string); ok {
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
	if bval, ok := ctx.Value(localizerCancelableKey).(bool); ok && bval {
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

func IsEmojiHarvesterCtx(ctx context.Context) bool {
	if bval, ok := ctx.Value(emojiHarvesterKey).(bool); ok && bval {
		return true
	}
	return false
}

func CtxMakeEmojiHarvester(ctx context.Context) context.Context {
	return context.WithValue(ctx, emojiHarvesterKey, true)
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
	if _, ok := res.Value(kfKey).(types.KeyFinder); !ok {
		res = context.WithValue(res, kfKey, g.CtxFactory.NewKeyFinder())
	}
	if _, ok := res.Value(inKey).(types.IdentifyNotifier); !ok {
		res = context.WithValue(res, inKey, notifier)
	}
	if _, ok := res.Value(upKey).(types.UPAKFinder); !ok {
		res = context.WithValue(res, upKey, g.CtxFactory.NewUPAKFinder())
	}
	if _, ok := res.Value(ctxMutexKey).(*sync.RWMutex); !ok {
		res = context.WithValue(res, ctxMutexKey, &sync.RWMutex{})
	}
	if _, ok := res.Value(rlKey).(map[string]chat1.RateLimit); !ok {
		res = context.WithValue(res, rlKey, make(map[string]chat1.RateLimit))
	}
	if _, ok := res.Value(messageSkipsKey).(map[chat1.ConvIDStr]MessageCacheSkip); !ok {
		res = context.WithValue(res, messageSkipsKey, make(map[chat1.ConvIDStr]MessageCacheSkip))
	}
	if _, ok := res.Value(unboxModeKey).(types.UnboxMode); !ok {
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
	rctx = libkb.WithLogTag(rctx, "CHTBKG")
	if IsLocalizerCancelableCtx(sourceCtx) {
		rctx = CtxAddLocalizerCancelable(rctx)
	}
	if IsEmojiHarvesterCtx(sourceCtx) {
		rctx = CtxMakeEmojiHarvester(rctx)
	}
	return rctx
}
