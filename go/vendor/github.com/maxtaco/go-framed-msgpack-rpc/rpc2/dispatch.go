package rpc2

import "sync"

type DecodeNext func(interface{}) error
type ServeHook func(DecodeNext) (interface{}, error)

// EOFHook is typically called when a transport has to shut down.
// We supply it with the exact error that caused the shutdown, which
// should be io.EOF under normal circumstances.
type EOFHook func(error)

type Dispatcher interface {
	Dispatch(m *Message) error
	Call(name string, arg interface{}, res interface{}, f UnwrapErrorFunc) error
	RegisterProtocol(Protocol) error
	RegisterEOFHook(EOFHook) error
	Reset(error) error
}

type Protocol struct {
	Name      string
	Methods   map[string]ServeHook
	WrapError WrapErrorFunc
}

type Dispatch struct {
	protocols  map[string]Protocol
	calls      map[int]*Call
	seqid      int
	callsMutex *sync.Mutex
	xp         Transporter
	log        LogInterface
	wrapError  WrapErrorFunc
	eofHook    EOFHook
}

func NewDispatch(xp Transporter, l LogInterface, wef WrapErrorFunc) *Dispatch {
	return &Dispatch{
		protocols:  make(map[string]Protocol),
		calls:      make(map[int]*Call),
		seqid:      0,
		callsMutex: new(sync.Mutex),
		xp:         xp,
		log:        l,
		wrapError:  wef,
	}
}

type Request struct {
	msg       *Message
	dispatch  *Dispatch
	seqno     int
	method    string
	err       interface{}
	res       interface{}
	hook      ServeHook
	wrapError WrapErrorFunc
}

type Call struct {
	ch          chan error
	method      string
	seqid       int
	res         interface{}
	unwrapError UnwrapErrorFunc
	profiler    Profiler
}

func (c *Call) Init() {
	c.ch = make(chan error)
}

func (r *Request) reply() error {
	v := []interface{}{
		TYPE_RESPONSE,
		r.seqno,
		r.err,
		r.res,
	}
	return r.msg.Encode(v)
}

func (r *Request) serve() {
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

func (d *Dispatch) nextSeqid() int {
	ret := d.seqid
	d.seqid++
	return ret
}

func (d *Dispatch) registerCall(c *Call) {
	d.calls[c.seqid] = c
}

func (d *Dispatch) Call(name string, arg interface{}, res interface{}, f UnwrapErrorFunc) (err error) {

	d.callsMutex.Lock()

	seqid := d.nextSeqid()
	v := []interface{}{TYPE_CALL, seqid, name, arg}
	profiler := d.log.StartProfiler("call %s", name)
	call := &Call{
		method:      name,
		seqid:       seqid,
		res:         res,
		unwrapError: f,
		profiler:    profiler,
	}
	call.Init()
	d.registerCall(call)

	d.callsMutex.Unlock()

	err = d.xp.Encode(v)
	if err != nil {
		return
	}
	d.log.ClientCall(seqid, name, arg)
	err = <-call.ch
	return
}

func (d *Dispatch) findServeHook(n string) (srv ServeHook, wrapError WrapErrorFunc, err error) {
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

func (d *Dispatch) dispatchCall(m *Message) (err error) {
	req := Request{msg: m, dispatch: d}

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

func (d *Dispatch) RegisterProtocol(p Protocol) (err error) {
	if _, found := d.protocols[p.Name]; found {
		err = AlreadyRegisteredError{p.Name}
	} else {
		d.protocols[p.Name] = p
	}
	return err
}

// RegisterEOFHook registers a function to call when the dispatcher
// hits EOF. The hook will be called with whatever error caused the
// channel to close.  Usually this should be io.EOF, but it can
// of course be otherwise.
func (d *Dispatch) RegisterEOFHook(h EOFHook) error {
	d.eofHook = h
	return nil
}

func (d *Dispatch) dispatchResponse(m *Message) (err error) {
	var seqno int

	if err = m.Decode(&seqno); err != nil {
		return
	}

	d.callsMutex.Lock()
	var call *Call
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

func (d *Dispatch) Reset(eofError error) error {
	d.callsMutex.Lock()
	for k, v := range d.calls {
		v.ch <- EofError{}
		delete(d.calls, k)
	}
	d.callsMutex.Unlock()
	if d.eofHook != nil {
		d.eofHook(eofError)
	}
	return nil
}

func (d *Dispatch) Dispatch(m *Message) (err error) {
	if m.nFields == 4 {
		err = d.dispatchQuad(m)
	} else {
		err = NewDispatcherError("can only handle message quads (got n=%d fields)", m.nFields)
	}
	return
}

func (d *Dispatch) dispatchQuad(m *Message) (err error) {
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
