package libkb

import (
	"sync"

	"golang.org/x/net/context"
)

type RPCCancellerKey string

func NewRPCCancellerKey() RPCCancellerKey {
	return RPCCancellerKey(RandStringB64(3))
}

type liveContext struct {
	ctx      context.Context
	cancelFn context.CancelFunc
}

type RPCCanceller struct {
	sync.Mutex
	liveCtxs map[RPCCancellerKey]liveContext
}

func NewRPCCanceller() *RPCCanceller {
	return &RPCCanceller{
		liveCtxs: make(map[RPCCancellerKey]liveContext),
	}
}

func (r *RPCCanceller) RegisterContext(ctx context.Context) (context.Context, RPCCancellerKey) {
	r.Lock()
	defer r.Unlock()
	var lc liveContext
	lc.ctx, lc.cancelFn = context.WithCancel(ctx)
	id := NewRPCCancellerKey()
	r.liveCtxs[id] = lc
	return lc.ctx, id
}

func (r *RPCCanceller) UnregisterContext(id RPCCancellerKey) {
	r.Lock()
	defer r.Unlock()
	if lc, ok := r.liveCtxs[id]; ok {
		lc.cancelFn()
		delete(r.liveCtxs, id)
	}
}

func (r *RPCCanceller) CancelLiveContexts() {
	r.Lock()
	defer r.Unlock()
	for id, liveCtx := range r.liveCtxs {
		liveCtx.cancelFn()
		delete(r.liveCtxs, id)
	}
}
