package rpc

import (
	"io"
	"sync"
)

type ServeHandlerDescription struct {
	MakeArg    func() interface{}
	Handler    func(arg interface{}) (ret interface{}, err error)
	MethodType MethodType
}

type MethodType int

const (
	MethodCall     MethodType = 0
	MethodResponse            = 1
	MethodNotify              = 2
)

type ErrorUnwrapper interface {
	MakeArg() interface{}
	UnwrapError(arg interface{}) (appError error, dispatchError error)
}

type dispatcher interface {
	Call(name string, arg interface{}, res interface{}, u ErrorUnwrapper) error
	Notify(name string, arg interface{}) error
	RegisterProtocol(Protocol) error
	Dispatch(l int) error
	Close(err error) chan struct{}
	AddCloseListener(chan error)
}

type Protocol struct {
	Name      string
	Methods   map[string]ServeHandlerDescription
	WrapError WrapErrorFunc
}

type dispatch struct {
	enc              encoder
	dec              byteReadingDecoder
	protocols        map[string]Protocol
	seqid            int
	listeners        map[chan error]struct{}
	listenerMtx      sync.Mutex
	callCh           chan *call
	callRespCh       chan *call
	rmCallCh         chan int
	stopCh           chan struct{}
	closedCh         chan struct{}
	writeCh          chan []byte
	errCh            chan error
	log              LogInterface
	wrapErrorFunc    WrapErrorFunc
	dispatchHandlers map[MethodType]messageHandler
}

type messageHandler struct {
	dispatchFunc  func() error
	messageLength int
}

func newDispatch(enc encoder, dec byteReadingDecoder, l LogInterface, wef WrapErrorFunc) *dispatch {
	d := &dispatch{
		enc:           enc,
		dec:           dec,
		protocols:     make(map[string]Protocol),
		listeners:     make(map[chan error]struct{}),
		callCh:        make(chan *call),
		callRespCh:    make(chan *call),
		rmCallCh:      make(chan int),
		stopCh:        make(chan struct{}),
		closedCh:      make(chan struct{}),
		seqid:         0,
		log:           l,
		wrapErrorFunc: wef,
	}
	d.dispatchHandlers = map[MethodType]messageHandler{
		MethodNotify:   {dispatchFunc: d.dispatchNotify, messageLength: 3},
		MethodCall:     {dispatchFunc: d.dispatchCall, messageLength: 4},
		MethodResponse: {dispatchFunc: d.dispatchResponse, messageLength: 4},
	}
	go d.callLoop()
	return d
}

type call struct {
	ch             chan error
	method         string
	seqid          int
	arg            interface{}
	res            interface{}
	errorUnwrapper ErrorUnwrapper
	profiler       Profiler
}

func newCall(m string, arg interface{}, res interface{}, u ErrorUnwrapper, p Profiler) *call {
	return &call{
		ch:             make(chan error),
		method:         m,
		arg:            arg,
		res:            res,
		errorUnwrapper: u,
		profiler:       p,
	}
}

func (d *dispatch) callLoop() {
	calls := make(map[int]*call)
	for {
		select {
		case <-d.stopCh:
			for _, v := range calls {
				v.ch <- io.EOF
			}
			close(d.closedCh)
			return
		case c := <-d.callCh:
			seqid := d.nextSeqid()
			c.seqid = seqid
			v := []interface{}{MethodCall, seqid, c.method, c.arg}
			calls[c.seqid] = c
			err := d.enc.Encode(v)
			if err != nil {
				c.ch <- err
				continue
			}
			d.log.ClientCall(seqid, c.method, c.arg)
		case seqid := <-d.rmCallCh:
			call := calls[seqid]
			delete(calls, seqid)
			d.callRespCh <- call
		}
	}
}

func (d *dispatch) nextSeqid() int {
	ret := d.seqid
	d.seqid++
	return ret
}

func (d *dispatch) Call(name string, arg interface{}, res interface{}, u ErrorUnwrapper) error {
	profiler := d.log.StartProfiler("call %s", name)
	call := newCall(name, arg, res, u, profiler)
	d.callCh <- call
	return <-call.ch
}

func (d *dispatch) Notify(name string, arg interface{}) (err error) {

	v := []interface{}{MethodNotify, name, arg}
	err = d.enc.Encode(v)
	if err != nil {
		return
	}
	d.log.ClientNotify(name, arg)
	return
}

func (d *dispatch) findServeHandler(n string) (*ServeHandlerDescription, WrapErrorFunc, error) {
	p, m := SplitMethodName(n)
	prot, found := d.protocols[p]
	if !found {
		return nil, d.wrapErrorFunc, ProtocolNotFoundError{p}
	}
	srv, found := prot.Methods[m]
	if !found {
		return nil, d.wrapErrorFunc, MethodNotFoundError{p, m}
	}
	return &srv, prot.WrapError, nil
}

func (d *dispatch) RegisterProtocol(p Protocol) (err error) {
	if _, found := d.protocols[p.Name]; found {
		err = AlreadyRegisteredError{p.Name}
	} else {
		d.protocols[p.Name] = p
	}
	return err
}

func (d *dispatch) Close(err error) chan struct{} {
	close(d.stopCh)
	d.broadcast(err)
	return d.closedCh
}

func (d *dispatch) AddCloseListener(ch chan error) {
	d.listenerMtx.Lock()
	defer d.listenerMtx.Unlock()
	d.listeners[ch] = struct{}{}
}

func (d *dispatch) broadcast(err error) {
	d.listenerMtx.Lock()
	defer d.listenerMtx.Unlock()
	for ch := range d.listeners {
		select {
		case ch <- err:
		default:
		}
	}
}

func (d *dispatch) Dispatch(length int) error {
	var requestType MethodType
	if err := d.dec.Decode(&requestType); err != nil {
		return err
	}
	handler, ok := d.dispatchHandlers[requestType]
	if !ok {
		return NewDispatcherError("invalid message type")
	}
	if length != handler.messageLength {
		return NewDispatcherError("wrong number of fields for message (got n=%d, expected n=%d)", length, handler.messageLength)

	}
	return handler.dispatchFunc()
}

func (d *dispatch) dispatchNotify() (err error) {
	req := newRequest(MethodNotify)
	return d.handleDispatch(req)
}

func (d *dispatch) dispatchCall() error {
	req := newRequest(MethodCall)
	return d.handleDispatch(req)
}

func (d *dispatch) handleDispatch(req request) error {
	if err := decodeIntoRequest(d.dec, req); err != nil {
		return err
	}

	m := req.Message()
	var se error
	var wrapErrorFunc WrapErrorFunc
	var serveHandler *ServeHandlerDescription
	if serveHandler, wrapErrorFunc, se = d.findServeHandler(m.method); se != nil {
		m.err = wrapError(wrapErrorFunc, se)
		if err := decodeToNull(d.dec, m); err != nil {
			return err
		}
		req.LogInvocation(d.log, se, nil)
		return req.Reply(d.enc, d.log)
	}
	d.serveRequest(req, serveHandler, wrapErrorFunc)
	return nil
}

func (d *dispatch) serveRequest(r request, handler *ServeHandlerDescription, wrapErrorFunc WrapErrorFunc) {
	m := r.Message()
	prof := d.log.StartProfiler("serve %s", m.method)

	arg := handler.MakeArg()
	err := decodeMessage(d.dec, m, arg)

	go func() {
		r.LogInvocation(d.log, err, arg)
		if err != nil {
			m.err = wrapError(wrapErrorFunc, err)
		} else {
			res, err := handler.Handler(arg)
			m.err = wrapError(wrapErrorFunc, err)
			m.res = res
		}
		prof.Stop()
		r.LogCompletion(d.log, err)
		r.Reply(d.enc, d.log)
	}()
}

// Server
func (d *dispatch) dispatchResponse() (err error) {
	m := &message{remainingFields: 3}

	if err = decodeMessage(d.dec, m, &m.seqno); err != nil {
		return err
	}

	d.rmCallCh <- m.seqno
	call := <-d.callRespCh

	if call == nil {
		d.log.UnexpectedReply(m.seqno)
		return decodeToNull(d.dec, m)
	}

	var apperr error

	call.profiler.Stop()

	if apperr, err = decodeError(d.dec, m, call.errorUnwrapper); err == nil {
		decodeTo := call.res
		if decodeTo == nil {
			decodeTo = new(interface{})
		}
		err = decodeMessage(d.dec, m, decodeTo)
		d.log.ClientReply(m.seqno, call.method, err, decodeTo)
	} else {
		d.log.ClientReply(m.seqno, call.method, err, nil)
	}

	if err != nil {
		decodeToNull(d.dec, m)
		if apperr == nil {
			apperr = err
		}
	}

	call.ch <- apperr

	return
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
