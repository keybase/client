package types

import (
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type KeyfinderKey int
type IdentifyNotifierKey int
type ChatTrace int
type IdentifyModeKey int
type UpakfinderKey int
type RateLimitKey int
type NameInfoOverride int
type LocalizerCancelableKeyTyp int

var KfKey KeyfinderKey
var InKey IdentifyNotifierKey
var ChatTraceKey ChatTrace
var IdentModeKey IdentifyModeKey
var UpKey UpakfinderKey
var RlKey RateLimitKey
var NameInfoOverrideKey NameInfoOverride
var LocalizerCancelableKey LocalizerCancelableKeyTyp

type IdentModeData struct {
	Mode   keybase1.TLFIdentifyBehavior
	Breaks *[]keybase1.TLFIdentifyFailure
}

func IdentifyMode(ctx context.Context) (ib keybase1.TLFIdentifyBehavior, breaks *[]keybase1.TLFIdentifyFailure, ok bool) {
	var imd IdentModeData
	val := ctx.Value(IdentModeKey)
	if imd, ok = val.(IdentModeData); ok {
		return imd.Mode, imd.Breaks, ok
	}
	return keybase1.TLFIdentifyBehavior_CHAT_CLI, nil, false
}

func CtxOverrideNameInfoSource(ctx context.Context) (NameInfoSource, bool) {
	val := ctx.Value(NameInfoOverrideKey)
	if ni, ok := val.(NameInfoSource); ok {
		return ni, true
	}
	return nil, false
}

func IsLocalizerCancelableCtx(ctx context.Context) bool {
	val := ctx.Value(LocalizerCancelableKey)
	if _, ok := val.(bool); ok {
		return true
	}
	return false
}
func CtxTrace(ctx context.Context) (string, bool) {
	var trace string
	var ok bool
	val := ctx.Value(ChatTraceKey)
	if trace, ok = val.(string); ok {
		return trace, true
	}
	return "", false
}
