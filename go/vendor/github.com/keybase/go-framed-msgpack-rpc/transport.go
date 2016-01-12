package rpc

import (
	"bufio"
	"io"
	"net"

	"github.com/ugorji/go/codec"
)

type WrapErrorFunc func(error) interface{}

type Transporter interface {
	getDispatcher() (dispatcher, error)
	getReceiver() (receiver, error)
	Run() error
	RunAsync() error
	IsConnected() bool
	AddCloseListener(ch chan<- error)
	RegisterProtocol(p Protocol) error
}

type transporter interface {
	Transporter
}

type connDecoder struct {
	decoder
	net.Conn
	Reader *bufio.Reader
}

func newConnDecoder(c net.Conn) *connDecoder {
	br := bufio.NewReader(c)
	mh := &codec.MsgpackHandle{WriteExt: true}

	return &connDecoder{
		Conn:    c,
		Reader:  br,
		decoder: codec.NewDecoder(br, mh),
	}
}

var _ transporter = (*transport)(nil)

type transport struct {
	cdec       *connDecoder
	enc        *framedMsgpackEncoder
	dispatcher dispatcher
	receiver   receiver
	packetizer packetizer
	protocols  *protocolHandler
	calls      *callContainer
	log        LogInterface
	startCh    chan struct{}
	stopCh     chan struct{}
}

func NewTransport(c net.Conn, l LogFactory, wef WrapErrorFunc) Transporter {
	cdec := newConnDecoder(c)
	if l == nil {
		l = NewSimpleLogFactory(nil, nil)
	}
	log := l.NewLog(cdec.RemoteAddr())

	startCh := make(chan struct{}, 1)
	startCh <- struct{}{}

	ret := &transport{
		cdec:      cdec,
		log:       log,
		startCh:   startCh,
		stopCh:    make(chan struct{}),
		protocols: newProtocolHandler(wef),
		calls:     newCallContainer(),
	}
	enc := newFramedMsgpackEncoder(ret.cdec)
	ret.enc = enc
	ret.dispatcher = newDispatch(enc, ret.calls, log)
	ret.receiver = newReceiveHandler(enc, ret.protocols, log)
	ret.packetizer = newPacketHandler(cdec.Reader, ret.protocols, ret.calls)
	return ret
}

func (t *transport) IsConnected() bool {
	select {
	case <-t.stopCh:
		return false
	default:
		return true
	}
}

func (t *transport) Run() error {
	if !t.IsConnected() {
		return io.EOF
	}

	select {
	case <-t.startCh:
		return t.run()
	default:
		return nil
	}
}

func (t *transport) RunAsync() error {
	if !t.IsConnected() {
		return io.EOF
	}

	select {
	case <-t.startCh:
		go func() {
			err := t.run()
			if err != nil && err != io.EOF {
				t.log.Warning("asynchronous t.run() failed with %v", err)
			}
		}()
	default:
	}

	return nil
}

func (t *transport) run() (err error) {
	// Packetize: do work
	for {
		var rpc rpcMessage
		if rpc, err = t.packetizer.NextFrame(); err == nil {
			t.receiver.Receive(rpc)
			continue
		}
		break
	}

	// Log packetizer completion
	t.log.TransportError(err)

	// Since the receiver might require the transport, we have to
	// close it before terminating our loops
	close(t.stopCh)
	t.dispatcher.Close()
	<-t.receiver.Close(err)
	<-t.enc.Close()

	// Cleanup
	t.cdec.Close()

	return
}

func (t *transport) getDispatcher() (dispatcher, error) {
	if !t.IsConnected() {
		return nil, io.EOF
	}
	return t.dispatcher, nil
}

func (t *transport) getReceiver() (receiver, error) {
	if !t.IsConnected() {
		return nil, io.EOF
	}
	return t.receiver, nil
}

func (t *transport) RegisterProtocol(p Protocol) error {
	return t.protocols.registerProtocol(p)
}

func (t *transport) AddCloseListener(ch chan<- error) {
	t.receiver.AddCloseListener(ch)
}
