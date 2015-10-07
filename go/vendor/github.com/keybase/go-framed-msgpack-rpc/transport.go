package rpc

import (
	"bufio"
	"github.com/ugorji/go/codec"
	"io"
	"net"
	"sync"
)

type WrapErrorFunc func(error) interface{}
type UnwrapErrorFunc func(nxt DecodeNext) (error, error)

type Transporter interface {
	getDispatcher() (dispatcher, error)
	Run() error
	IsConnected() bool
}

type transporter interface {
	Transporter
	io.ByteReader
	Decoder
	Encoder
	sync.Locker
}

type connDecoder struct {
	Decoder
	net.Conn
	io.ByteReader
}

func newConnDecoder(c net.Conn) *connDecoder {
	br := bufio.NewReader(c)
	mh := &codec.MsgpackHandle{WriteExt: true}

	return &connDecoder{
		Conn:       c,
		ByteReader: br,
		Decoder:    codec.NewDecoder(br, mh),
	}
}

var _ transporter = (*transport)(nil)

type transport struct {
	sync.Locker
	ByteEncoder
	cdec             *connDecoder
	dispatcher       dispatcher
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
	byteEncoder := newFramedMsgpackEncoder()

	ret := &transport{
		Locker:           new(sync.Mutex),
		ByteEncoder:      byteEncoder,
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
	ret.dispatcher = newDispatch(ret.encodeCh, ret.encodeResultCh, log, wef)
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
		err = t.run2()
	})
	return
}

func (t *transport) run2() (err error) {
	// Initialize transport loops
	readerDone := runInBg(t.readerLoop)
	writerDone := runInBg(t.writerLoop)

	// Packetize: do work
	packetizer := newPacketizer(t.dispatcher, t)
	err = packetizer.Packetize()

	// Log packetizer completion and terminate transport loops
	t.log.TransportError(err)
	close(t.stopCh)

	// Wait for loops to finish before resetting
	<-readerDone
	<-writerDone
	t.reset()
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

func (t *transport) reset() {
	t.dispatcher.Reset()
	t.dispatcher = nil
	t.cdec.Close()
	t.cdec = nil
}

type byteResult struct {
	b   byte
	err error
}

func (t *transport) Encode(i interface{}) error {
	bytes, err := t.EncodeToBytes(i)
	if err != nil {
		return err
	}
	t.encodeCh <- bytes
	err = <-t.encodeResultCh
	return err
}

func (t *transport) ReadByte() (byte, error) {
	t.readByteCh <- struct{}{}
	byteRes := <-t.readByteResultCh
	return byteRes.b, byteRes.err
}

func (t *transport) Decode(i interface{}) error {
	t.decodeCh <- i
	return <-t.decodeResultCh
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
