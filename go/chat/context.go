package chat

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
)

// KeybaseContext defines what chat needs from Keybase
type KeybaseContext interface {
	GetLog() logger.Logger
	LoadUserByUID(uid keybase1.UID) (*libkb.User, error)
	UIDToUsername(uid keybase1.UID) (libkb.NormalizedUsername, error)
	Clock() clockwork.Clock
	GetUPAKLoader() libkb.UPAKLoader
	GetMerkleClient() *libkb.MerkleClient
}

type identifyModeKey int
type keyfinderKey int

var identModeKey identifyModeKey
var kfKey keyfinderKey

type identModeData struct {
	mode   keybase1.TLFIdentifyBehavior
	breaks *[]keybase1.TLFIdentifyFailure
}

func identifyModeCtx(ctx context.Context, mode keybase1.TLFIdentifyBehavior,
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

func Context(ctx context.Context, mode keybase1.TLFIdentifyBehavior,
	breaks *[]keybase1.TLFIdentifyFailure) context.Context {
	res := identifyModeCtx(ctx, mode, breaks)
	res = context.WithValue(res, kfKey, NewKeyFinder())
	return res
}

func BackgroundContext(sourceCtx context.Context) context.Context {

	rctx := context.Background()
	if ident, breaks, ok := IdentifyMode(sourceCtx); ok {
		rctx = Context(rctx, ident, breaks)
	}

	rctx = context.WithValue(rctx, kfKey, CtxKeyFinder(sourceCtx))

	return rctx
}
