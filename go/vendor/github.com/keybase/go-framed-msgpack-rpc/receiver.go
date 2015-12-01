package rpc

import (
	"sync"

	"golang.org/x/net/context"
)

type messageHandler struct {
	dispatchFunc  func() error
	messageLength int
}

type task struct {
	seqid      seqNumber
	cancelFunc context.CancelFunc
}

type receiver interface {
	Receive(l int) error
	RegisterProtocol(Protocol) error
	Close(err error) chan struct{}
	AddCloseListener(chan error)
}

type callRetrieval struct {
	seqid seqNumber
	ch    chan *call
}

type receiveHandler struct {
	writer encoder
	reader byteReadingDecoder

	protocols     map[string]Protocol
	wrapErrorFunc WrapErrorFunc
	tasks         map[int]context.CancelFunc

	listenerMtx sync.Mutex
	listeners   map[chan error]struct{}

	// Stops all loops when closed
	stopCh chan struct{}
	// Closed once all loops are finished
	closedCh chan struct{}

	rmCallCh chan callRetrieval

	// Task loop channels
	taskBeginCh  chan *task
	taskCancelCh chan seqNumber
	taskEndCh    chan seqNumber

	log             LogInterface
	messageHandlers map[MethodType]messageHandler
}

func newReceiveHandler(enc encoder, dec byteReadingDecoder, rmCallCh chan callRetrieval, l LogInterface, wef WrapErrorFunc) *receiveHandler {
	r := &receiveHandler{
		writer:    enc,
		reader:    dec,
		protocols: make(map[string]Protocol),
		tasks:     make(map[int]context.CancelFunc),
		listeners: make(map[chan error]struct{}),
		rmCallCh:  rmCallCh,
		stopCh:    make(chan struct{}),
		closedCh:  make(chan struct{}),

		taskBeginCh:  make(chan *task),
		taskCancelCh: make(chan seqNumber),
		taskEndCh:    make(chan seqNumber),

		log:           l,
		wrapErrorFunc: wef,
	}
	r.messageHandlers = map[MethodType]messageHandler{
		MethodNotify:   {dispatchFunc: r.receiveNotify, messageLength: 3},
		MethodCall:     {dispatchFunc: r.receiveCall, messageLength: 4},
		MethodResponse: {dispatchFunc: r.receiveResponse, messageLength: 4},
		MethodCancel:   {dispatchFunc: r.receiveCancel, messageLength: 3},
	}
	go r.taskLoop()
	return r
}

func (r *receiveHandler) taskLoop() {
	tasks := make(map[seqNumber]context.CancelFunc)
	for {
		select {
		case <-r.stopCh:
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

func (r *receiveHandler) findServeHandler(n string) (*ServeHandlerDescription, WrapErrorFunc, error) {
	p, m := splitMethodName(n)
	prot, found := r.protocols[p]
	if !found {
		return nil, r.wrapErrorFunc, ProtocolNotFoundError{p}
	}
	srv, found := prot.Methods[m]
	if !found {
		return nil, r.wrapErrorFunc, MethodNotFoundError{p, m}
	}
	return &srv, prot.WrapError, nil
}

func (d *receiveHandler) Receive(length int) error {
	var requestType MethodType
	if err := d.reader.Decode(&requestType); err != nil {
		return err
	}
	handler, ok := d.messageHandlers[requestType]
	if !ok {
		return NewDispatcherError("invalid message type")
	}
	if length != handler.messageLength {
		return NewDispatcherError("wrong number of fields for message (got n=%d, expected n=%d)", length, handler.messageLength)

	}
	return handler.dispatchFunc()
}

func (r *receiveHandler) receiveNotify() (err error) {
	req := newRequest(MethodNotify)
	return r.handleReceiveDispatch(req)
}

func (r *receiveHandler) receiveCall() error {
	req := newRequest(MethodCall)
	return r.handleReceiveDispatch(req)
}

func (r *receiveHandler) receiveCancel() (err error) {
	req := newRequest(MethodCancel)
	if err := decodeIntoMessage(r.reader, req.Message()); err != nil {
		return err
	}
	req.LogInvocation(r.log, nil, nil)
	r.taskCancelCh <- req.Message().seqno
	return nil
}

func (r *receiveHandler) handleReceiveDispatch(req request) error {
	if err := decodeIntoMessage(r.reader, req.Message()); err != nil {
		return err
	}

	m := req.Message()
	serveHandler, wrapErrorFunc, se := r.findServeHandler(m.method)
	if se != nil {
		m.err = wrapError(wrapErrorFunc, se)
		if err := decodeToNull(r.reader, m); err != nil {
			return err
		}
		req.LogInvocation(r.log, se, nil)
		return req.Reply(r.writer, r.log)
	}
	r.taskBeginCh <- &task{m.seqno, req.CancelFunc()}
	req.Serve(r.reader, r.writer, serveHandler, wrapErrorFunc, r.log)
	return nil
}

func (r *receiveHandler) receiveResponse() (err error) {
	m := &message{remainingFields: 3}

	if err = decodeMessage(r.reader, m, &m.seqno); err != nil {
		return err
	}

	ch := make(chan *call)
	r.rmCallCh <- callRetrieval{m.seqno, ch}
	call := <-ch

	if call == nil {
		r.log.UnexpectedReply(m.seqno)
		decodeToNull(r.reader, m)
		return CallNotFoundError{m.seqno}
	}

	var apperr error

	call.profiler.Stop()

	if apperr, err = decodeError(r.reader, m, call.errorUnwrapper); err == nil {
		decodeTo := call.res
		if decodeTo == nil {
			decodeTo = new(interface{})
		}
		err = decodeMessage(r.reader, m, decodeTo)
		r.log.ClientReply(m.seqno, call.method, err, decodeTo)
	} else {
		r.log.ClientReply(m.seqno, call.method, err, nil)
	}

	if err != nil {
		decodeToNull(r.reader, m)
		if apperr == nil {
			apperr = err
		}
	}

	_ = call.Finish(apperr)

	return
}

func (r *receiveHandler) RegisterProtocol(p Protocol) (err error) {
	if _, found := r.protocols[p.Name]; found {
		err = AlreadyRegisteredError{p.Name}
	} else {
		r.protocols[p.Name] = p
	}
	return err
}

func (r *receiveHandler) Close(err error) chan struct{} {
	close(r.stopCh)
	r.broadcast(err)
	return r.closedCh
}

func (r *receiveHandler) AddCloseListener(ch chan error) {
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
