package rpc

import (
	"bufio"
	"io"
	"net"
	"sync"

	"github.com/ugorji/go/codec"
)

type WrapErrorFunc func(error) interface{}

type Transporter interface {
	getDispatcher() (dispatcher, error)
	Run() error
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
	enc              encoder
	dec              byteReadingDecoder
	log              LogInterface
	wrapError        WrapErrorFunc
	startOnce        sync.Once
	encodeCh         chan []byte
	encodeResultCh   chan error
	readByteCh       chan struct{}
	readByteResultCh chan byteResult
	decodeCh         chan interface{}
	decodeResultCh   chan error
	stopCh           chan struct{}
}

func NewTransport(c net.Conn, l LogFactory, wef WrapErrorFunc) Transporter {
	cdec := newConnDecoder(c)
	if l == nil {
		l = NewSimpleLogFactory(nil, nil)
	}
	log := l.NewLog(cdec.RemoteAddr())

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
		stopCh:           make(chan struct{}),
	}
	ret.enc = newFramedMsgpackEncoder(ret.encodeCh, ret.encodeResultCh)
	ret.dec = newFramedMsgpackDecoder(ret.decodeCh, ret.decodeResultCh, ret.readByteCh, ret.readByteResultCh)
	ret.dispatcher = newDispatch(ret.enc, ret.dec, log, wef)
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

func (t *transport) Run() (err error) {
	if !t.IsConnected() {
		return DisconnectedError{}
	}
	t.startOnce.Do(func() {
		err = t.run()
	})
	return
}

func (t *transport) run() (err error) {
	// Initialize transport loops
	readerDone := runInBg(t.readerLoop)
	writerDone := runInBg(t.writerLoop)

	// Packetize: do work
	packetizer := newPacketizer(t.dispatcher, t.dec)
	err = packetizer.Packetize()

	// Log packetizer completion
	t.log.TransportError(err)

	// Since the dispatcher might require the transport, we have to
	// close it before terminating our loops
	<-t.dispatcher.Close(err)
	close(t.stopCh)

	// Wait for loops to finish before closing the connection
	<-readerDone
	<-writerDone

	// Cleanup
	t.cdec.Close()

	return
}

func (t *transport) readerLoop() {
	for {
		select {
		case <-t.stopCh:
			return
		case i := <-t.decodeCh:
			err := t.cdec.Decode(i)
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

func (t *transport) writerLoop() {
	for {
		select {
		case <-t.stopCh:
			return
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

func runInBg(f func()) chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)
		f()
	}()
	return done
}
