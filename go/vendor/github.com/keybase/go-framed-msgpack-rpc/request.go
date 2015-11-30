package rpc

import (
	"fmt"

	"golang.org/x/net/context"
)

type request interface {
	Message() *message
	CancelFunc() context.CancelFunc
	Context() context.Context
	Reply() error
	Serve(interface{}, HandlerFunc, WrapErrorFunc)
	LogInvocation(err error, arg interface{})
	LogCompletion(err error)
	setContext(context.Context)
}

const (
	callRequestLength   int = 5
	notifyRequestLength     = 4
	responseLength          = 4
	cancelRequestLength     = 3
)

type requestImpl struct {
	message
	ctx        context.Context
	cancelFunc context.CancelFunc
	log        LogInterface
	writer     encoder
	reader     decoder
}

func (req *requestImpl) Message() *message {
	return &req.message
}

func (req *requestImpl) CancelFunc() context.CancelFunc {
	return req.cancelFunc
}

func (req *requestImpl) Context() context.Context {
	return req.ctx
}

func (req *requestImpl) setContext(ctx context.Context) {
	req.ctx = ctx
}

func (r *requestImpl) LogInvocation(error, interface{}) {}
func (r *requestImpl) LogCompletion(error)              {}
func (r *requestImpl) Reply() error                     { return nil }

func (r *requestImpl) Serve(interface{}, HandlerFunc, WrapErrorFunc) {
}

type callRequest struct {
	requestImpl
	doneCh chan<- seqNumber
}

func newCallRequest(reader decoder, writer encoder, log LogInterface, doneCh chan<- seqNumber) *callRequest {
	ctx, cancel := context.WithCancel(context.Background())
	r := &callRequest{
		requestImpl: requestImpl{
			message: message{
				remainingFields: callRequestLength - 1,
			},
			ctx:        ctx,
			cancelFunc: cancel,
			reader:     reader,
			writer:     writer,
			log:        log,
		},
		doneCh: doneCh,
	}
	r.decodeSlots = []interface{}{
		&r.seqno,
		&r.method,
	}
	return r
}

func (r *callRequest) LogInvocation(err error, arg interface{}) {
	r.log.ServerCall(r.seqno, r.method, err, arg)
}

func (r *callRequest) LogCompletion(err error) {
	r.log.ServerReply(r.seqno, r.method, err, r.res)
}

func (r *callRequest) Reply() error {
	var err error
	select {
	case <-r.ctx.Done():
		err = fmt.Errorf("call canceled for seqno %d", r.seqno)
		r.log.Warning(err.Error())
	default:
		v := []interface{}{
			MethodResponse,
			r.seqno,
			r.err,
			r.res,
		}
		err = r.writer.Encode(v)
		if err != nil {
			r.log.Warning("Reply error for %d: %s", r.seqno, err.Error())
		}
	}
	r.doneCh <- r.seqno
	return err
}

func (r *callRequest) Serve(arg interface{}, handler HandlerFunc, wrapErrorFunc WrapErrorFunc) {

	prof := r.log.StartProfiler("serve %s", r.method)

	go func() {
		var err error
		var res interface{}
		if r.err == nil {
			res, err = handler(r.ctx, arg)
			r.err = wrapError(wrapErrorFunc, err)
			r.res = res
		}
		prof.Stop()
		r.LogCompletion(err)
		r.Reply()
	}()
}

type notifyRequest struct {
	requestImpl
}

func newNotifyRequest(reader decoder, writer encoder, log LogInterface) *notifyRequest {
	ctx, cancel := context.WithCancel(context.Background())
	r := &notifyRequest{
		requestImpl: requestImpl{
			message: message{
				remainingFields: notifyRequestLength - 1,
			},
			ctx:        ctx,
			cancelFunc: cancel,
			reader:     reader,
			writer:     writer,
			log:        log,
		},
	}
	r.decodeSlots = []interface{}{
		&r.method,
	}
	return r
}

func (r *notifyRequest) LogInvocation(err error, arg interface{}) {
	r.log.ServerNotifyCall(r.method, err, arg)
}

func (r *notifyRequest) LogCompletion(err error) {
	r.log.ServerNotifyComplete(r.method, err)
}

func (r *notifyRequest) Serve(arg interface{}, handler HandlerFunc, wrapErrorFunc WrapErrorFunc) {

	prof := r.log.StartProfiler("serve-notify %s", r.method)

	go func() {
		var err error
		if r.err == nil {
			_, err = handler(r.ctx, arg)
		}
		prof.Stop()
		r.LogCompletion(err)
	}()
}

type cancelRequest struct {
	requestImpl
}

func newCancelRequest(log LogInterface) *cancelRequest {
	r := &cancelRequest{
		requestImpl: requestImpl{
			message: message{
				remainingFields: cancelRequestLength - 1,
			},
			ctx: context.Background(),
			log: log,
		},
	}
	r.decodeSlots = []interface{}{
		&r.seqno,
		&r.method,
	}
	return r
}

func (r *cancelRequest) LogInvocation(err error, arg interface{}) {
	r.log.ServerCancelCall(r.seqno, r.method)
}
