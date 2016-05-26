package rpc

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"
)

type rpcMessage interface {
	Type() MethodType
	Name() string
	SeqNo() seqNumber
	MinLength() int
	Err() error
	DecodeMessage(int, decoder, *protocolHandler, *callContainer) error
}

type basicRPCData struct {
	ctx context.Context
}

func (r *basicRPCData) Context() context.Context {
	if r.ctx == nil {
		return context.Background()
	}
	return r.ctx
}

func (r *basicRPCData) loadContext(l int, d decoder) error {
	if l == 0 {
		return nil
	}
	tags := make(CtxRpcTags)
	if err := d.Decode(&tags); err != nil {
		return err
	}
	r.ctx = AddRpcTagsToContext(context.Background(), tags)
	return nil
}

type rpcCallMessage struct {
	basicRPCData
	seqno seqNumber
	name  string
	arg   interface{}
	err   error
}

func (rpcCallMessage) MinLength() int {
	return 3
}

func (r *rpcCallMessage) DecodeMessage(l int, d decoder, p *protocolHandler, _ *callContainer) error {
	if r.err = d.Decode(&r.seqno); r.err != nil {
		return r.err
	}
	if r.err = d.Decode(&r.name); r.err != nil {
		return r.err
	}
	if r.arg, r.err = p.getArg(r.name); r.err != nil {
		return r.err
	}
	if r.err = d.Decode(r.arg); r.err != nil {
		return r.err
	}
	r.err = r.loadContext(l-r.MinLength(), d)
	return r.err
}

func (r rpcCallMessage) Type() MethodType {
	return MethodCall
}

func (r rpcCallMessage) SeqNo() seqNumber {
	return r.seqno
}

func (r rpcCallMessage) Name() string {
	return r.name
}

func (r rpcCallMessage) Arg() interface{} {
	return r.arg
}

func (r rpcCallMessage) Err() error {
	return r.err
}

type rpcResponseMessage struct {
	c           *call
	err         error
	responseErr error
}

func (r rpcResponseMessage) MinLength() int {
	return 3
}

func (r *rpcResponseMessage) DecodeMessage(l int, d decoder, _ *protocolHandler, cc *callContainer) error {
	var seqNo seqNumber
	if r.err = d.Decode(&seqNo); r.err != nil {
		return r.err
	}

	// Attempt to retrieve the call
	r.c = cc.RetrieveCall(seqNo)
	if r.c == nil {
		r.err = newCallNotFoundError(seqNo)
		return r.err
	}

	// Decode the error
	var responseErr interface{}
	if r.c.errorUnwrapper != nil {
		responseErr = r.c.errorUnwrapper.MakeArg()
	} else {
		responseErr = new(string)
	}
	if r.err = d.Decode(responseErr); r.err != nil {
		return r.err
	}

	// Ensure the error is wrapped correctly
	if r.c.errorUnwrapper != nil {
		r.responseErr, r.err = r.c.errorUnwrapper.UnwrapError(responseErr)
		if r.err != nil {
			return r.err
		}
	} else {
		errAsString, ok := responseErr.(*string)
		if !ok {
			r.err = fmt.Errorf("unable to convert error to string: %v", responseErr)
			return r.err
		}
		if *errAsString != "" {
			r.responseErr = errors.New(*errAsString)
		}
	}

	// Decode the result
	if r.c.res == nil {
		return nil
	}
	r.err = d.Decode(r.c.res)
	return r.err
}

func (r rpcResponseMessage) Type() MethodType {
	return MethodResponse
}

func (r rpcResponseMessage) SeqNo() seqNumber {
	if r.c == nil {
		return -1
	}
	return r.c.seqid
}

func (r rpcResponseMessage) Name() string {
	if r.c == nil {
		return ""
	}
	return r.c.method
}

func (r rpcResponseMessage) Err() error {
	return r.err
}

func (r rpcResponseMessage) ResponseErr() error {
	return r.responseErr
}

func (r rpcResponseMessage) Res() interface{} {
	if r.c == nil {
		return nil
	}
	return r.c.res
}

func (r rpcResponseMessage) ResponseCh() chan *rpcResponseMessage {
	if r.c == nil {
		return nil
	}
	return r.c.resultCh
}

type rpcNotifyMessage struct {
	basicRPCData
	name string
	arg  interface{}
	err  error
}

func (r *rpcNotifyMessage) DecodeMessage(l int, d decoder, p *protocolHandler, _ *callContainer) error {
	if r.err = d.Decode(&r.name); r.err != nil {
		return r.err
	}
	if r.arg, r.err = p.getArg(r.name); r.err != nil {
		return r.err
	}
	if r.err = d.Decode(r.arg); r.err != nil {
		return r.err
	}
	r.err = r.loadContext(l-r.MinLength(), d)
	return r.err
}

func (rpcNotifyMessage) MinLength() int {
	return 2
}

func (r rpcNotifyMessage) Type() MethodType {
	return MethodNotify
}

func (r rpcNotifyMessage) SeqNo() seqNumber {
	return -1
}

func (r rpcNotifyMessage) Name() string {
	return r.name
}

func (r rpcNotifyMessage) Arg() interface{} {
	return r.arg
}

func (r rpcNotifyMessage) Err() error {
	return r.err
}

type rpcCancelMessage struct {
	seqno seqNumber
	name  string
	err   error
}

func (r *rpcCancelMessage) DecodeMessage(l int, d decoder, p *protocolHandler, _ *callContainer) error {
	if r.err = d.Decode(&r.seqno); r.err != nil {
		return r.err
	}
	r.err = d.Decode(&r.name)
	return r.err
}

func (rpcCancelMessage) MinLength() int {
	return 2
}

func (r rpcCancelMessage) Type() MethodType {
	return MethodCancel
}

func (r rpcCancelMessage) SeqNo() seqNumber {
	return r.seqno
}

func (r rpcCancelMessage) Name() string {
	return r.name
}

func (r rpcCancelMessage) Err() error {
	return r.err
}

func decodeRPC(l int, d decoder, p *protocolHandler, cc *callContainer) (rpcMessage, error) {
	typ := MethodInvalid
	if err := d.Decode(&typ); err != nil {
		return nil, newRPCDecodeError(typ, "", l, err)
	}

	var data rpcMessage
	switch typ {
	case MethodCall:
		data = &rpcCallMessage{}
	case MethodResponse:
		data = &rpcResponseMessage{}
	case MethodNotify:
		data = &rpcNotifyMessage{}
	case MethodCancel:
		data = &rpcCancelMessage{}
	default:
		return nil, newRPCDecodeError(typ, "", l, errors.New("invalid RPC type"))
	}

	dataLength := l - 1
	if dataLength < data.MinLength() {
		return nil, newRPCDecodeError(typ, "", l, errors.New("wrong message length"))
	}

	if err := data.DecodeMessage(dataLength, d, p, cc); err != nil {
		return data, newRPCDecodeError(typ, data.Name(), l, err)
	}
	return data, nil
}
