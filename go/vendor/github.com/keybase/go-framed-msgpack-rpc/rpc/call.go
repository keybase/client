package rpc

import (
	"sync"

	"golang.org/x/net/context"
)

type call struct {
	ctx context.Context

	resultCh chan *rpcResponseMessage

	method         string
	seqid          SeqNumber
	arg            interface{}
	res            interface{}
	ctype          CompressionType
	errorUnwrapper ErrorUnwrapper
	instrumenter   *NetworkInstrumenter
}

type callContainer struct {
	callsMtx sync.RWMutex
	calls    map[SeqNumber]*call
	seqMtx   sync.Mutex
	seqid    SeqNumber
}

func newCallContainer() *callContainer {
	return &callContainer{
		calls: make(map[SeqNumber]*call),
		seqid: 0,
	}
}

func (cc *callContainer) NewCall(ctx context.Context, m string, arg interface{}, res interface{},
	ctype CompressionType, u ErrorUnwrapper, instrumenter *NetworkInstrumenter) *call {
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
		ctype:          ctype,
		errorUnwrapper: u,
		seqid:          cc.nextSeqid(),
		instrumenter:   instrumenter,
	}
}

func (cc *callContainer) nextSeqid() SeqNumber {
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

func (cc *callContainer) RetrieveCall(seqid SeqNumber) *call {
	cc.callsMtx.RLock()
	defer cc.callsMtx.RUnlock()

	return cc.calls[seqid]
}

func (cc *callContainer) RemoveCall(seqid SeqNumber) {
	cc.callsMtx.Lock()
	defer cc.callsMtx.Unlock()

	delete(cc.calls, seqid)
}
