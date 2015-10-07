package rpc

import "sync"

type DecodeNext func(interface{}) error
type ServeHook func(DecodeNext) (interface{}, error)
type ServeNotifyHook func(DecodeNext) error

type dispatcher interface {
	Call(name string, arg interface{}, res interface{}, f UnwrapErrorFunc) error
	Notify(name string, arg interface{}) error
	RegisterProtocol(Protocol) error
	Dispatch(m *message) error
	Reset() error
}

type Protocol struct {
	Name          string
	Methods       map[string]ServeHook
	NotifyMethods map[string]ServeNotifyHook
	WrapError     WrapErrorFunc
}

type dispatch struct {
	enc        ByteEncoder
	protocols  map[string]Protocol
	calls      map[int]*call
	seqid      int
	callsMutex *sync.Mutex
	writeCh    chan []byte
	errCh      chan error
	log        LogInterface
	wrapError  WrapErrorFunc
}

func newDispatch(writeCh chan []byte, errCh chan error, l LogInterface, wef WrapErrorFunc) *dispatch {
	return &dispatch{
		enc:        newFramedMsgpackEncoder(),
		protocols:  make(map[string]Protocol),
		calls:      make(map[int]*call),
		seqid:      0,
		callsMutex: new(sync.Mutex),
		log:        l,
		wrapError:  wef,
		writeCh:    writeCh,
		errCh:      errCh,
	}
}

type request struct {
	msg       *message
	dispatch  *dispatch
	seqno     int
	method    string
	err       interface{}
	res       interface{}
	hook      ServeHook
	wrapError WrapErrorFunc
}

type notifyRequest struct {
	msg       *message
	dispatch  *dispatch
	method    string
	err       interface{}
	hook      ServeNotifyHook
	wrapError WrapErrorFunc
}

type call struct {
	ch          chan error
	method      string
	seqid       int
	res         interface{}
	unwrapError UnwrapErrorFunc
	profiler    Profiler
}

func (c *call) Init() {
	c.ch = make(chan error)
}

func (r *request) reply() error {
	v := []interface{}{
		TYPE_RESPONSE,
		r.seqno,
		r.err,
		r.res,
	}
	return r.msg.Encode(v)
}

func (r *request) serve() {
	prof := r.dispatch.log.StartProfiler("serve %s", r.method)
	nxt := r.msg.makeDecodeNext(func(v interface{}) {
		r.dispatch.log.ServerCall(r.seqno, r.method, nil, v)
	})

	go func() {
		res, err := r.hook(nxt)
		if prof != nil {
			prof.Stop()
		}
		r.err = r.msg.WrapError(r.wrapError, err)
		r.res = res
		r.dispatch.log.ServerReply(r.seqno, r.method, err, r.res)
		if err = r.reply(); err != nil {
			r.dispatch.log.Warning("Reply error for %d: %s", r.seqno, err.Error())
		}
	}()
}

func (r *notifyRequest) serve() {
	prof := r.dispatch.log.StartProfiler("serve %s", r.method)
	nxt := r.msg.makeDecodeNext(func(v interface{}) {
		r.dispatch.log.ServerNotifyCall(r.method, nil, v)
	})

	go func() {
		err := r.hook(nxt)
		if prof != nil {
			prof.Stop()
		}
		r.dispatch.log.ServerNotifyComplete(r.method, err)
	}()
}

func (d *dispatch) nextSeqid() int {
	ret := d.seqid
	d.seqid++
	return ret
}

func (d *dispatch) registerCall(c *call) {
	d.calls[c.seqid] = c
}

func (d *dispatch) Call(name string, arg interface{}, res interface{}, f UnwrapErrorFunc) (err error) {

	d.callsMutex.Lock()

	seqid := d.nextSeqid()
	v := []interface{}{TYPE_CALL, seqid, name, arg}
	profiler := d.log.StartProfiler("call %s", name)
	call := &call{
		method:      name,
		seqid:       seqid,
		res:         res,
		unwrapError: f,
		profiler:    profiler,
	}
	call.Init()
	d.registerCall(call)

	d.callsMutex.Unlock()

	err = d.sendEncoded(v)
	if err != nil {
		return err
	}
	d.log.ClientCall(seqid, name, arg)
	err = <-call.ch
	return
}

func (d *dispatch) Notify(name string, arg interface{}) (err error) {

	v := []interface{}{TYPE_NOTIFY, name, arg}
	err = d.sendEncoded(v)
	if err != nil {
		return
	}
	d.log.ClientNotify(name, arg)
	return
}

func (d *dispatch) sendEncoded(v interface{}) error {
	bytes, err := d.enc.EncodeToBytes(v)
	if err != nil {
		return err
	}
	d.writeCh <- bytes
	err = <-d.errCh
	return err
}

func (d *dispatch) findServeHook(n string) (srv ServeHook, wrapError WrapErrorFunc, err error) {
	p, m := SplitMethodName(n)
	var prot Protocol
	var found bool
	if prot, found = d.protocols[p]; !found {
		err = ProtocolNotFoundError{p}
	} else if srv, found = prot.Methods[m]; !found {
		err = MethodNotFoundError{p, m}
	}
	if found {
		wrapError = prot.WrapError
	}
	if wrapError == nil {
		wrapError = d.wrapError
	}
	return
}

func (d *dispatch) findServeNotifyHook(n string) (srv ServeNotifyHook, wrapError WrapErrorFunc, err error) {
	p, m := SplitMethodName(n)
	var prot Protocol
	var found bool
	if prot, found = d.protocols[p]; !found {
		err = ProtocolNotFoundError{p}
	} else if srv, found = prot.NotifyMethods[m]; !found {
		err = MethodNotFoundError{p, m}
	}
	if found {
		wrapError = prot.WrapError
	}
	if wrapError == nil {
		wrapError = d.wrapError
	}
	return
}

func (d *dispatch) dispatchNotify(m *message) (err error) {
	req := notifyRequest{msg: m, dispatch: d}

	if err = m.Decode(&req.method); err != nil {
		return
	}

	var se error
	var wrapError WrapErrorFunc
	if req.hook, wrapError, se = d.findServeNotifyHook(req.method); se != nil {
		req.err = m.WrapError(wrapError, se)
		if err = m.decodeToNull(); err != nil {
			return
		}
		d.log.ServerNotifyCall(req.method, se, nil)
	} else {
		req.wrapError = wrapError
		req.serve()
	}
	return
}

func (d *dispatch) dispatchCall(m *message) (err error) {
	req := request{msg: m, dispatch: d}

	if err = m.Decode(&req.seqno); err != nil {
		return
	}
	if err = m.Decode(&req.method); err != nil {
		return
	}

	var se error
	var wrapError WrapErrorFunc
	if req.hook, wrapError, se = d.findServeHook(req.method); se != nil {
		req.err = m.WrapError(wrapError, se)
		if err = m.decodeToNull(); err != nil {
			return
		}
		d.log.ServerCall(req.seqno, req.method, se, nil)
		err = req.reply()
	} else {
		req.wrapError = wrapError
		req.serve()
	}
	return
}

func (d *dispatch) RegisterProtocol(p Protocol) (err error) {
	if _, found := d.protocols[p.Name]; found {
		err = AlreadyRegisteredError{p.Name}
	} else {
		d.protocols[p.Name] = p
	}
	return err
}

func (d *dispatch) dispatchResponse(m *message) (err error) {
	var seqno int

	if err = m.Decode(&seqno); err != nil {
		return
	}

	d.callsMutex.Lock()
	var call *call
	if call = d.calls[seqno]; call != nil {
		delete(d.calls, seqno)
	}
	d.callsMutex.Unlock()

	if call == nil {
		d.log.UnexpectedReply(seqno)
		err = m.decodeToNull()
		return
	}

	var apperr error

	if call.profiler != nil {
		call.profiler.Stop()
	}

	if apperr, err = m.DecodeError(call.unwrapError); err == nil {
		decode_to := call.res
		if decode_to == nil {
			var tmp interface{}
			decode_to = &tmp
		}
		err = m.Decode(decode_to)
		d.log.ClientReply(seqno, call.method, err, decode_to)
	} else {
		d.log.ClientReply(seqno, call.method, err, nil)
	}

	if err != nil {
		m.decodeToNull()
		if apperr == nil {
			apperr = err
		}
	}

	call.ch <- apperr

	return
}

func (d *dispatch) Reset() error {
	d.callsMutex.Lock()
	for k, v := range d.calls {
		v.ch <- EofError{}
		delete(d.calls, k)
	}
	d.callsMutex.Unlock()
	return nil
}

func (d *dispatch) Dispatch(m *message) (err error) {
	switch m.nFields {
	case 3:
		err = d.dispatchTriple(m)
	case 4:
		err = d.dispatchQuad(m)
	default:
		err = NewDispatcherError("can only handle message quads (got n=%d fields)", m.nFields)
	}
	return
}

func (d *dispatch) dispatchTriple(m *message) (err error) {
	var l int
	if err = m.Decode(&l); err != nil {
		return
	}
	switch l {
	case TYPE_NOTIFY:
		d.dispatchNotify(m)
	default:
		err = NewDispatcherError("Unexpected message type=%d; wanted NOTIFY=%d",
			l, TYPE_NOTIFY)
	}
	return
}

func (d *dispatch) dispatchQuad(m *message) (err error) {
	var l int
	if err = m.Decode(&l); err != nil {
		return
	}

	switch l {
	case TYPE_CALL:
		d.dispatchCall(m)
	case TYPE_RESPONSE:
		d.dispatchResponse(m)
	default:
		err = NewDispatcherError("Unexpected message type=%d; wanted CALL=%d or RESPONSE=%d",
			l, TYPE_CALL, TYPE_RESPONSE)
	}
	return
}
