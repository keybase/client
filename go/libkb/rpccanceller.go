package libkb

import (
	"sync"

	"golang.org/x/net/context"
)

type RPCCancelerReason uint

const (
	RPCCancelerReasonLogout RPCCancelerReason = 1 << iota
	RPCCancelerReasonBackground
	RPCCancelerReasonMax
)

const RPCCancelerReasonAll = RPCCancelerReasonMax - 1

type RPCCancelerKey string

func NewRPCCancelerKey() RPCCancelerKey {
	return RPCCancelerKey(RandStringB64(3))
}

type liveContext struct {
	ctx      context.Context
	cancelFn context.CancelFunc
	reason   RPCCancelerReason
}

type RPCCanceler struct {
	sync.Mutex
	liveCtxs map[RPCCancelerKey]liveContext
}

func NewRPCCanceler() *RPCCanceler {
	return &RPCCanceler{
		liveCtxs: make(map[RPCCancelerKey]liveContext),
	}
}

func (r *RPCCanceler) RegisterContext(ctx context.Context, reason RPCCancelerReason) (context.Context, RPCCancelerKey) {
	r.Lock()
	defer r.Unlock()
	var lc liveContext
	lc.ctx, lc.cancelFn = context.WithCancel(ctx)
	id := NewRPCCancelerKey()
	lc.reason = reason
	r.liveCtxs[id] = lc
	return lc.ctx, id
}

func (r *RPCCanceler) UnregisterContext(id RPCCancelerKey) {
	r.Lock()
	defer r.Unlock()
	if lc, ok := r.liveCtxs[id]; ok {
		lc.cancelFn()
		delete(r.liveCtxs, id)
	}
}

func (r *RPCCanceler) CancelLiveContexts(reason RPCCancelerReason) {
	r.Lock()
	defer r.Unlock()
	for id, liveCtx := range r.liveCtxs {
		if liveCtx.reason&reason != 0 {
			liveCtx.cancelFn()
			delete(r.liveCtxs, id)
		}
	}
}
