package rpc

import (
	"bufio"
	"io"
	"net"

	"github.com/keybase/go-codec/codec"
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

func (t *transport) run() error {
	// Packetize: do work
	var err error
	for shouldContinue(err) {
		var rpc rpcMessage
		if rpc, err = t.packetizer.NextFrame(); shouldReceive(rpc) {
			t.receiver.Receive(rpc)
		}
	}

	// Log packetizer completion
	t.log.TransportError(err)

	// Since the receiver might require the transport, we have to
	// close it before terminating our loops
	close(t.stopCh)
	t.dispatcher.Close()
	<-t.receiver.Close(err)

	// First inform the encoder that it should close
	encoderClosed := t.enc.Close()
	// Unblock any remaining writes
	t.cdec.Close()
	// Wait for the encoder to finish handling the now unblocked writes
	<-encoderClosed

	return err
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

func shouldContinue(err error) bool {
	err = unboxRPCError(err)
	switch err.(type) {
	case nil:
		return true
	case CallNotFoundError:
		return true
	case MethodNotFoundError:
		return true
	case ProtocolNotFoundError:
		return true
	default:
		return false
	}
}

func shouldReceive(rpc rpcMessage) bool {
	if rpc == nil {
		return false
	}
	switch rpc.Err().(type) {
	case nil:
		return true
	case MethodNotFoundError:
		return true
	case ProtocolNotFoundError:
		return true
	default:
		return false
	}
}
