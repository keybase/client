package rpc

import (
	"errors"
	"fmt"
)

type rpcMessage interface {
	Type() MethodType
	Name() string
	SeqNo() seqNumber
	MinLength() int
	DecodeMessage(int, decoder, *protocolHandler, *callContainer) error
}

type rpcCallMessage struct {
	seqno seqNumber
	name  string
	arg   interface{}
}

func (rpcCallMessage) MinLength() int {
	return 3
}

func (r *rpcCallMessage) DecodeMessage(l int, d decoder, p *protocolHandler, _ *callContainer) (err error) {
	if err = d.Decode(&r.seqno); err != nil {
		return err
	}
	if err = d.Decode(&r.name); err != nil {
		return err
	}
	if r.arg, err = p.getArg(r.name); err != nil {
		return err
	}
	return d.Decode(r.arg)
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

type rpcResponseMessage struct {
	c   *call
	err error
}

func (r rpcResponseMessage) MinLength() int {
	return 3
}

func (r *rpcResponseMessage) DecodeMessage(l int, d decoder, _ *protocolHandler, cc *callContainer) error {
	var seqNo seqNumber
	if err := d.Decode(&seqNo); err != nil {
		return err
	}

	// Attempt to retrieve the call
	r.c = cc.RetrieveCall(seqNo)
	if r.c == nil {
		return newCallNotFoundError(seqNo)
	}

	// Decode the error
	var responseErr interface{}
	if r.c.errorUnwrapper != nil {
		responseErr = r.c.errorUnwrapper.MakeArg()
	} else {
		responseErr = new(string)
	}
	if err := d.Decode(responseErr); err != nil {
		return err
	}

	// Ensure the error is wrapped correctly
	if r.c.errorUnwrapper != nil {
		var dispatchErr error
		r.err, dispatchErr = r.c.errorUnwrapper.UnwrapError(responseErr)
		if dispatchErr != nil {
			return dispatchErr
		}
	} else {
		errAsString, ok := responseErr.(*string)
		if !ok {
			return fmt.Errorf("unable to convert error to string: %v", responseErr)
		}
		if *errAsString != "" {
			r.err = errors.New(*errAsString)
		}
	}

	// Decode the result
	if r.c.res == nil {
		return nil
	}
	return d.Decode(r.c.res)
}

func (r rpcResponseMessage) Type() MethodType {
	return MethodResponse
}

func (r rpcResponseMessage) SeqNo() seqNumber {
	return r.c.seqid
}

func (r rpcResponseMessage) Name() string {
	return r.c.method
}

func (r rpcResponseMessage) Err() error {
	return r.err
}

func (r rpcResponseMessage) Res() interface{} {
	return r.c.res
}

func (r rpcResponseMessage) ResponseCh() chan *rpcResponseMessage {
	return r.c.resultCh
}

type rpcNotifyMessage struct {
	name string
	arg  interface{}
}

func (r *rpcNotifyMessage) DecodeMessage(l int, d decoder, p *protocolHandler, _ *callContainer) (err error) {
	if err = d.Decode(&r.name); err != nil {
		return err
	}
	if r.arg, err = p.getArg(r.name); err != nil {
		return err
	}
	return d.Decode(r.arg)
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

type rpcCancelMessage struct {
	seqno seqNumber
	name  string
}

func (r *rpcCancelMessage) DecodeMessage(l int, d decoder, p *protocolHandler, _ *callContainer) (err error) {
	if err = d.Decode(&r.seqno); err != nil {
		return err
	}
	return d.Decode(&r.name)
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

func decodeRPC(l int, d decoder, p *protocolHandler, cc *callContainer) (rpcMessage, error) {
	typ := MethodInvalid
	if err := d.Decode(&typ); err != nil {
		return nil, newRPCDecodeError(typ, l, err)
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
		return nil, newRPCDecodeError(typ, l, errors.New("invalid RPC type"))
	}

	dataLength := l - 1
	if dataLength < data.MinLength() {
		return nil, newRPCDecodeError(typ, l, errors.New("wrong message length"))
	}

	if err := data.DecodeMessage(dataLength, d, p, cc); err != nil {
		return nil, newRPCDecodeError(typ, l, err)
	}
	return data, nil
}
