package rpc

import (
	"bufio"
	"io"
	"net"
	"strings"

	"github.com/ugorji/go/codec"
)

type WrapErrorFunc func(error) interface{}

type Transporter interface {
	getDispatcher() (dispatcher, error)
	getReceiver() (receiver, error)
	Run() error
	RunAsync() error
	IsConnected() bool
}

type transporter interface {
	Transporter
}

type connDecoder struct {
	decoder
	net.Conn
	io.ByteReader
}

func newConnDecoder(c net.Conn) *connDecoder {
	br := bufio.NewReader(c)
	mh := &codec.MsgpackHandle{WriteExt: true}

	return &connDecoder{
		Conn:       c,
		ByteReader: br,
		decoder:    codec.NewDecoder(br, mh),
	}
}

var _ transporter = (*transport)(nil)

type transport struct {
	cdec             *connDecoder
	dispatcher       dispatcher
	receiver         receiver
	packetizer       packetizer
	log              LogInterface
	wrapError        WrapErrorFunc
	encodeCh         chan []byte
	encodeResultCh   chan error
	readByteCh       chan struct{}
	readByteResultCh chan byteResult
	decodeCh         chan interface{}
	decodeResultCh   chan error
	startCh          chan struct{}
	stopCh           chan struct{}
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
		cdec:             cdec,
		log:              log,
		wrapError:        wef,
		encodeCh:         make(chan []byte),
		encodeResultCh:   make(chan error),
		readByteCh:       make(chan struct{}),
		readByteResultCh: make(chan byteResult),
		decodeCh:         make(chan interface{}),
		decodeResultCh:   make(chan error),
		startCh:          startCh,
		stopCh:           make(chan struct{}),
	}
	enc := newFramedMsgpackEncoder(ret.encodeCh, ret.encodeResultCh)
	dec := newFramedMsgpackDecoder(ret.decodeCh, ret.decodeResultCh, ret.readByteCh, ret.readByteResultCh)
	callRetrievalCh := make(chan callRetrieval)
	ret.dispatcher = newDispatch(enc, dec, callRetrievalCh, log)
	ret.receiver = newReceiveHandler(enc, dec, callRetrievalCh, log, wef)
	ret.packetizer = newPacketHandler(ret.receiver, dec)
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
		return DisconnectedError{}
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
		return DisconnectedError{}
	}

	select {
	case <-t.startCh:
		go func() {
			err := t.run()
			if err != nil {
				t.log.Warning("asynchronous t.run() failed with %v", err)
			}
		}()
	default:
	}

	return nil
}

func (t *transport) run() (err error) {
	// Initialize transport loops
	readerDone := runInBg(t.readerLoop)
	writerDone := runInBg(t.writerLoop)

	// Packetize: do work
	err = t.packetizer.Packetize()

	// Log packetizer completion
	t.log.TransportError(err)

	// Since the receiver might require the transport, we have to
	// close it before terminating our loops
	<-t.dispatcher.Close(err)
	<-t.receiver.Close(err)
	close(t.stopCh)

	// Wait for loops to finish before closing the connection
	<-readerDone
	<-writerDone

	// Cleanup
	t.cdec.Close()

	return
}

func (t *transport) readerLoop() error {
	for {
		select {
		case <-t.stopCh:
			return nil
		case i := <-t.decodeCh:
			err := t.cdec.Decode(i)
			if err != nil && strings.Index(err.Error(), "use of closed network connection") >= 0 {
				err = io.EOF
			}
			t.decodeResultCh <- err
		case <-t.readByteCh:
			b, err := t.cdec.ReadByte()
			res := byteResult{
				b:   b,
				err: err,
			}
			t.readByteResultCh <- res
		}
	}
}

func (t *transport) writerLoop() error {
	for {
		select {
		case <-t.stopCh:
			return nil
		case bytes := <-t.encodeCh:
			_, err := t.cdec.Write(bytes)
			t.encodeResultCh <- err
		}
	}
}

func (t *transport) getDispatcher() (dispatcher, error) {
	if !t.IsConnected() {
		return nil, DisconnectedError{}
	}
	return t.dispatcher, nil
}

func (t *transport) getReceiver() (receiver, error) {
	if !t.IsConnected() {
		return nil, DisconnectedError{}
	}
	return t.receiver, nil
}
