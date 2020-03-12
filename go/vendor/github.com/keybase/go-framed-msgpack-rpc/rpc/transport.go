package rpc

import (
	"fmt"
	"io"
	"net"
	"sync"
)

type WrapErrorFunc func(error) interface{}

type Transporter interface {
	// IsConnected returns false when incoming packets have
	// finished processing.
	//
	// TODO: Use a better name.
	IsConnected() bool

	registerProtocol(p Protocol) error

	getDispatcher() (dispatcher, error)
	getReceiver() (receiver, error)

	// receiveFrames starts processing incoming frames in a
	// background goroutine, if it's not already happening.
	// Returns the result of done(), for convenience.
	receiveFrames() <-chan struct{}

	// Returns a channel that's closed when incoming frames have
	// finished processing, either due to an error or the
	// underlying connection being closed. Successive calls to
	// done() return the same value.
	done() <-chan struct{}

	// err returns a non-nil error value after done() is closed.
	// After done() is closed, successive calls to err return the
	// same value.
	err() error

	// Close closes the transport and releases resources.
	Close()
}

var _ Transporter = (*transport)(nil)

type transport struct {
	c          net.Conn
	enc        *framedMsgpackEncoder
	dispatcher dispatcher
	receiver   receiver
	packetizer *packetizer
	protocols  *protocolHandler
	calls      *callContainer
	log        LogInterface
	closeOnce  sync.Once
	startOnce  sync.Once
	stopCh     chan struct{}

	// Filled in right before stopCh is closed.
	stopErr error
}

// DefaultMaxFrameLength (100 MiB) is a reasonable default value for
// the maxFrameLength parameter in NewTransporter.
const DefaultMaxFrameLength = 100 * 1024 * 1024

// NewTransport creates a new Transporter from the given connection
// and parameters. Both sides of a connection should use the same
// number for maxFrameLength.
func NewTransport(c net.Conn, l LogFactory, instrumenterStorage NetworkInstrumenterStorage, wef WrapErrorFunc, maxFrameLength int32) Transporter {
	if maxFrameLength <= 0 {
		panic(fmt.Sprintf("maxFrameLength must be positive: got %d", maxFrameLength))
	}

	if l == nil {
		l = NewSimpleLogFactory(nil, nil)
	}
	log := l.NewLog(c.RemoteAddr())
	if instrumenterStorage == nil {
		instrumenterStorage = NewDummyInstrumentationStorage()
	}

	ret := &transport{
		c:         c,
		log:       log,
		stopCh:    make(chan struct{}),
		protocols: newProtocolHandler(wef),
		calls:     newCallContainer(),
	}
	enc := newFramedMsgpackEncoder(maxFrameLength, c)
	ret.enc = enc
	ret.dispatcher = newDispatch(enc, ret.calls, log, instrumenterStorage)
	ret.receiver = newReceiveHandler(enc, ret.protocols, log)
	ret.packetizer = newPacketizer(maxFrameLength, c, ret.protocols, ret.calls, log, instrumenterStorage)
	return ret
}

func (t *transport) Close() {
	t.closeOnce.Do(func() {
		// Since the receiver might require the transport, we have to
		// close it before terminating our loops
		close(t.stopCh)
		t.dispatcher.Close()
		<-t.receiver.Close()

		// First inform the encoder that it should close
		encoderClosed := t.enc.Close()
		// Unblock any remaining writes
		t.c.Close()
		// Wait for the encoder to finish handling the now unblocked writes
		<-encoderClosed
	})
}

func (t *transport) IsConnected() bool {
	select {
	case <-t.stopCh:
		return false
	default:
		return true
	}
}

func (t *transport) receiveFrames() <-chan struct{} {
	t.startOnce.Do(func() {
		go t.receiveFramesLoop()
	})
	return t.stopCh
}

func (t *transport) done() <-chan struct{} {
	return t.stopCh
}

func (t *transport) err() error {
	select {
	case <-t.stopCh:
		return t.stopErr
	default:
		return nil
	}
}

func (t *transport) receiveFramesLoop() {
	// Packetize: do work
	var err error
	for shouldContinue(err) {
		var rpc rpcMessage
		if rpc, err = t.packetizer.NextFrame(); shouldReceive(rpc) {
			if rerr := t.receiver.Receive(rpc); rerr != nil {
				t.log.Info("error on Receive: %v", rerr)
			}
		}
	}

	// Log packetizer completion
	t.log.TransportError(err)

	// This must happen before stopCh is closed to have a correct
	// ordering.
	t.stopErr = err

	t.Close()
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

func (t *transport) registerProtocol(p Protocol) error {
	return t.protocols.registerProtocol(p)
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
