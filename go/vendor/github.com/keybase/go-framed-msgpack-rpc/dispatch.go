package rpc

import (
	"io"

	"golang.org/x/net/context"
)

type dispatcher interface {
	Call(ctx context.Context, name string, arg interface{}, res interface{}, u ErrorUnwrapper) error
	Notify(ctx context.Context, name string, arg interface{}) error
	Close(err error) chan struct{}
}

type dispatch struct {
	writer encoder
	reader byteReadingDecoder

	seqid seqNumber

	// Stops all loops when closed
	stopCh chan struct{}
	// Closed once all loops are finished
	closedCh chan struct{}

	callCh     chan *call
	callRespCh chan *call
	rmCallCh   chan callRetrieval

	// Task loop channels
	taskBeginCh  chan *task
	taskCancelCh chan int
	taskEndCh    chan int

	log LogInterface
}

func newDispatch(enc encoder, dec byteReadingDecoder, callRetrievalCh chan callRetrieval, l LogInterface) *dispatch {
	d := &dispatch{
		writer:     enc,
		reader:     dec,
		callCh:     make(chan *call),
		callRespCh: make(chan *call),
		rmCallCh:   callRetrievalCh,
		stopCh:     make(chan struct{}),
		closedCh:   make(chan struct{}),

		taskBeginCh:  make(chan *task),
		taskCancelCh: make(chan int),
		taskEndCh:    make(chan int),

		seqid: 0,
		log:   l,
	}
	go d.callLoop()
	return d
}

type call struct {
	ctx            context.Context
	ch             chan error
	doneCh         chan struct{}
	method         string
	seqid          seqNumber
	arg            interface{}
	res            interface{}
	errorUnwrapper ErrorUnwrapper
	profiler       Profiler
}

func newCall(ctx context.Context, m string, arg interface{}, res interface{}, u ErrorUnwrapper, p Profiler) *call {
	return &call{
		ctx:            ctx,
		ch:             make(chan error),
		doneCh:         make(chan struct{}),
		method:         m,
		arg:            arg,
		res:            res,
		errorUnwrapper: u,
		profiler:       p,
	}
}

func (c *call) Finish(err error) {
	// Ensure we only send a response if something is waiting on c.ch
	select {
	case c.ch <- err:
		close(c.doneCh)
	case <-c.doneCh:
	}
}

func (d *dispatch) callLoop() {
	calls := make(map[seqNumber]*call)
	for {
		select {
		case <-d.stopCh:
			for _, c := range calls {
				c.Finish(io.EOF)
			}
			close(d.closedCh)
			return
		case c := <-d.callCh:
			d.handleCall(calls, c)
		case cr := <-d.rmCallCh:
			call := calls[cr.seqid]
			delete(calls, cr.seqid)
			cr.ch <- call
		}
	}
}

func (d *dispatch) handleCall(calls map[seqNumber]*call, c *call) {
	seqid := d.nextSeqid()
	c.seqid = seqid
	calls[c.seqid] = c
	err := d.dispatchMessage(c.ctx, MethodCall, seqid, c.method, c.arg)
	if err != nil {
		c.Finish(err)
		return
	}
	d.log.ClientCall(seqid, c.method, c.arg)
	go func() {
		select {
		case <-c.ctx.Done():
			c.ch <- newCanceledError(c.method, seqid)
			err := d.writer.Encode([]interface{}{MethodCancel, seqid, c.method})
			d.log.ClientCancel(seqid, c.method, err)
		case <-c.doneCh:
		}
	}()
}

func (d *dispatch) nextSeqid() seqNumber {
	ret := d.seqid
	d.seqid++
	return ret
}

func (d *dispatch) Call(ctx context.Context, name string, arg interface{}, res interface{}, u ErrorUnwrapper) error {
	profiler := d.log.StartProfiler("call %s", name)
	call := newCall(ctx, name, arg, res, u, profiler)
	d.callCh <- call
	return <-call.ch
}

func (d *dispatch) Notify(ctx context.Context, name string, arg interface{}) error {
	err := d.dispatchMessage(ctx, MethodNotify, name, arg)
	if err != nil {
		return err
	}
	d.log.ClientNotify(name, arg)
	return nil
}

func (d *dispatch) Close(err error) chan struct{} {
	close(d.stopCh)
	return d.closedCh
}

func (d *dispatch) dispatchMessage(ctx context.Context, args ...interface{}) error {
	rpcTags, _ := RpcTagsFromContext(ctx)
	return d.writer.Encode(append(args, rpcTags))
}

func wrapError(f WrapErrorFunc, e error) interface{} {
	if f != nil {
		return f(e)
	}
	if e == nil {
		return nil
	}
	return e.Error()
}
