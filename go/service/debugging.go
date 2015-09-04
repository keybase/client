package service

import (
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type DebuggingHandler struct {
	*BaseHandler
}

func NewDebuggingHandler(xp *rpc2.Transport) *DebuggingHandler {
	return &DebuggingHandler{BaseHandler: NewBaseHandler(xp)}
}

func (t DebuggingHandler) FirstStep(arg keybase1.FirstStepArg) (result keybase1.FirstStepResult, err error) {
	client := t.rpcClient()
	cbArg := keybase1.SecondStepArg{Val: arg.Val + 1, SessionID: arg.SessionID}
	var cbReply int
	err = client.Call("keybase.1.debugging.secondStep", []interface{}{cbArg}, &cbReply)
	if err != nil {
		return
	}

	result.ValPlusTwo = cbReply
	return
}

func (t DebuggingHandler) SecondStep(arg keybase1.SecondStepArg) (val int, err error) {
	val = arg.Val + 1
	return
}

func (t DebuggingHandler) Increment(arg keybase1.IncrementArg) (val int, err error) {
	val = arg.Val + 1
	return
}
