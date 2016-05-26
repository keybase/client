package rpc

import (
	"sync"

	"golang.org/x/net/context"
)

type call struct {
	ctx context.Context

	resultCh chan *rpcResponseMessage

	method         string
	seqid          seqNumber
	arg            interface{}
	res            interface{}
	errorUnwrapper ErrorUnwrapper
}

type callContainer struct {
	callsMtx sync.RWMutex
	calls    map[seqNumber]*call
	seqMtx   sync.Mutex
	seqid    seqNumber
}

func newCallContainer() *callContainer {
	return &callContainer{
		calls: make(map[seqNumber]*call),
		seqid: 0,
	}
}

func (cc *callContainer) NewCall(ctx context.Context, m string, arg interface{}, res interface{}, u ErrorUnwrapper) *call {
	// Buffer one response to take into account that a call stops
	// waiting for its result when its canceled. (See
	// https://github.com/keybase/go-framed-msgpack-rpc/issues/62
	// .)
	return &call{
		ctx:            ctx,
		resultCh:       make(chan *rpcResponseMessage, 1),
		method:         m,
		arg:            arg,
		res:            res,
		errorUnwrapper: u,
		seqid:          cc.nextSeqid(),
	}
}

func (cc *callContainer) nextSeqid() seqNumber {
	cc.seqMtx.Lock()
	defer cc.seqMtx.Unlock()

	ret := cc.seqid
	cc.seqid++
	return ret
}

func (cc *callContainer) AddCall(c *call) {
	cc.callsMtx.Lock()
	defer cc.callsMtx.Unlock()

	cc.calls[c.seqid] = c
}

func (cc *callContainer) RetrieveCall(seqid seqNumber) *call {
	cc.callsMtx.RLock()
	defer cc.callsMtx.RUnlock()

	return cc.calls[seqid]
}

func (cc *callContainer) RemoveCall(seqid seqNumber) {
	cc.callsMtx.Lock()
	defer cc.callsMtx.Unlock()

	delete(cc.calls, seqid)
}
