package rpc

import (
	"sync"

	"golang.org/x/net/context"
)

type task struct {
	seqid      seqNumber
	cancelFunc context.CancelFunc
}

type receiver interface {
	Receive(rpcMessage) error
	Close(err error) chan struct{}
	AddCloseListener(chan<- error)
}

type receiveHandler struct {
	writer      encoder
	protHandler *protocolHandler

	tasks map[int]context.CancelFunc

	listenerMtx sync.Mutex
	listeners   map[chan<- error]struct{}

	// Stops all loops when closed
	stopCh chan struct{}
	// Closed once all loops are finished
	closedCh chan struct{}

	// Task loop channels
	taskBeginCh  chan *task
	taskCancelCh chan seqNumber
	taskEndCh    chan seqNumber

	log LogInterface
}

func newReceiveHandler(enc encoder, protHandler *protocolHandler, l LogInterface) *receiveHandler {
	r := &receiveHandler{
		writer:      enc,
		protHandler: protHandler,
		tasks:       make(map[int]context.CancelFunc),
		listeners:   make(map[chan<- error]struct{}),
		stopCh:      make(chan struct{}),
		closedCh:    make(chan struct{}),

		taskBeginCh:  make(chan *task),
		taskCancelCh: make(chan seqNumber),
		taskEndCh:    make(chan seqNumber),

		log: l,
	}
	go r.taskLoop()
	return r
}

func (r *receiveHandler) taskLoop() {
	tasks := make(map[seqNumber]context.CancelFunc)
	for {
		select {
		case <-r.stopCh:
			for _, cancelFunc := range tasks {
				cancelFunc()
			}
			close(r.closedCh)
			return
		case t := <-r.taskBeginCh:
			tasks[t.seqid] = t.cancelFunc
		case seqid := <-r.taskCancelCh:
			if cancelFunc, ok := tasks[seqid]; ok {
				cancelFunc()
			}
			delete(tasks, seqid)
		case seqid := <-r.taskEndCh:
			delete(tasks, seqid)
		}
	}
}

func (r *receiveHandler) Receive(rpc rpcMessage) error {
	switch message := rpc.(type) {
	case *rpcNotifyMessage:
		return r.receiveNotify(message)
	case *rpcCallMessage:
		return r.receiveCall(message)
	case *rpcResponseMessage:
		return r.receiveResponse(message)
	case *rpcCancelMessage:
		return r.receiveCancel(message)
	default:
		return NewReceiverError("invalid message type, %d", rpc.Type())
	}
}

func (r *receiveHandler) receiveNotify(rpc *rpcNotifyMessage) error {
	req := newNotifyRequest(rpc, r.log)
	return r.handleReceiveDispatch(req)
}

func (r *receiveHandler) receiveCall(rpc *rpcCallMessage) error {
	req := newCallRequest(rpc, r.log)
	return r.handleReceiveDispatch(req)
}

func (r *receiveHandler) receiveCancel(rpc *rpcCancelMessage) error {
	r.log.ServerCancelCall(rpc.SeqNo(), rpc.Name())
	r.taskCancelCh <- rpc.SeqNo()
	return nil
}

func (r *receiveHandler) handleReceiveDispatch(req request) error {
	if req.Err() != nil {
		req.LogInvocation(req.Err())
		return req.Reply(r.writer, nil, wrapError(r.protHandler.wef, req.Err()))
	}
	serveHandler, wrapErrorFunc, se := r.protHandler.findServeHandler(req.Name())
	if se != nil {
		req.LogInvocation(se)
		return req.Reply(r.writer, nil, wrapError(wrapErrorFunc, se))
	}
	r.taskBeginCh <- &task{req.SeqNo(), req.CancelFunc()}
	go req.Serve(r.writer, serveHandler, wrapErrorFunc)
	return nil
}

func (r *receiveHandler) receiveResponse(rpc *rpcResponseMessage) (err error) {
	callResponseCh := rpc.ResponseCh()

	if callResponseCh == nil {
		r.log.UnexpectedReply(rpc.SeqNo())
		return newCallNotFoundError(rpc.SeqNo())
	}

	callResponseCh <- rpc
	return nil
}

func (r *receiveHandler) Close(err error) chan struct{} {
	close(r.stopCh)
	r.broadcast(err)
	return r.closedCh
}

func (r *receiveHandler) AddCloseListener(ch chan<- error) {
	r.listenerMtx.Lock()
	defer r.listenerMtx.Unlock()
	r.listeners[ch] = struct{}{}
}

func (r *receiveHandler) broadcast(err error) {
	r.listenerMtx.Lock()
	defer r.listenerMtx.Unlock()
	for ch := range r.listeners {
		select {
		case ch <- err:
		default:
		}
	}
}
