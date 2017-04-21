package types

import (
	"context"

	"github.com/keybase/client/go/protocol/keybase1"
)

type identifyModeKey int

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
