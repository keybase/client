package libkb

import (
	"bytes"
	"io"
	"net"
	"sync"
	"syscall"
	"time"
)

// LoopbackAddr is an address class that implement the net.Addr interface for loopback
// devices
type LoopbackAddr struct{}

// LoopbackListener is a listener that creates new loopback connections.
// It is goroutine safe.
type LoopbackListener struct {
	ch       chan *LoopbackConn
	isClosed bool
}

// LoopbackConn implments the net.Conn interface but is used to loopback
// from a process to itself. It is goroutine safe.
type LoopbackConn struct {
	wMutex          sync.Mutex // Locks the write Path
	rMutex          sync.Mutex // Locks the read Path
	isClosed        bool
	isPartnerClosed bool
	ch              chan []byte
	partnerCh       chan []byte
	buf             bytes.Buffer
}

// NewLoopbackListener creates a new Loopback listener
func NewLoopbackListener() *LoopbackListener {
	return &LoopbackListener{
		ch:       make(chan *LoopbackConn),
		isClosed: false,
	}
}

// NewLoopbackConnPair makes a new loopback connection pair
func NewLoopbackConnPair() (*LoopbackConn, *LoopbackConn) {
	a := &LoopbackConn{ch: make(chan []byte)}
	b := &LoopbackConn{ch: make(chan []byte)}
	a.partnerCh = b.ch
	b.partnerCh = a.ch
	return a, b
}

// LoopbackDial dials the given LoopbackListener and yields an new net.Conn
// that's a connection to it.
func (ll *LoopbackListener) Dial() (net.Conn, error) {
	G.Log.Debug("+ LoopbackListener.Dial")
	a, b := NewLoopbackConnPair()
	ll.ch <- a
	G.Log.Debug("- LoopbackListener.Dial", b)
	return b, nil
}

// Accept waits for and returns the next connection to the listener.
func (ll *LoopbackListener) Accept() (ret net.Conn, err error) {
	G.Log.Debug("+ LoopbackListener.Accept")
	if ll.isClosed {
		err = syscall.EINVAL
	} else {
		ret = <-ll.ch
	}
	G.Log.Debug("- LoopbackListener.Accept")
	return ret, err
}

// Close closes the listener.
// Any blocked Accept operations will be unblocked and return errors
func (ll *LoopbackListener) Close() (err error) {
	ll.isClosed = true
	return
}

// Addr returns the listener's network address.
func (ll *LoopbackListener) Addr() (addr net.Addr) {
	return LoopbackAddr{}
}

// Read reads data from the connection.
// Read can be made to time out and return a Error with Timeout() == true
// after a fixed time limit; see SetDeadline and SetReadDeadline.
func (lc *LoopbackConn) Read(b []byte) (n int, err error) {
	lc.rMutex.Lock()
	defer lc.rMutex.Unlock()
	G.Log.Debug("+ Read()")
	defer func() {
		G.Log.Debug("- Read() -> (%d, %v)", n, err)
	}()

	if lc.buf.Len() > 0 {
		return lc.buf.Read(b)
	}
	if lc.isPartnerClosed {
		return 0, io.EOF
	}
	msg := <-lc.ch
	G.Log.Debug("Got msg -> %v", msg)
	if msg == nil {
		lc.isPartnerClosed = true
		return 0, io.EOF
	}
	lc.buf.Write(msg)
	return lc.buf.Read(b)
}

// Write writes data to the connection.
// Write can be made to time out and return a Error with Timeout() == true
// after a fixed time limit; see SetDeadline and SetWriteDeadline.
func (lc *LoopbackConn) Write(b []byte) (n int, err error) {
	lc.wMutex.Lock()
	defer lc.wMutex.Unlock()
	if lc.isClosed {
		return 0, syscall.EINVAL
	}
	G.Log.Debug("+ Sent message -> %v\n", b)
	lc.partnerCh <- b
	return len(b), nil

}

// Close closes the connection.
// Any blocked Read or Write operations will be unblocked and return errors.
func (lc *LoopbackConn) Close() (err error) {
	lc.wMutex.Lock()
	defer lc.wMutex.Unlock()
	lc.isClosed = true
	lc.partnerCh <- nil
	return nil
}

// LocalAddr returns the local network address.
func (lc *LoopbackConn) LocalAddr() (addr net.Addr) {
	return
}

// RemoteAddr returns the remote network address.
func (lc *LoopbackConn) RemoteAddr() (addr net.Addr) {
	return
}

// SetDeadline sets the read and write deadlines associated
// with the connection. It is equivalent to calling both
// SetReadDeadline and SetWriteDeadline.
//
// A deadline is an absolute time after which I/O operations
// fail with a timeout (see type Error) instead of
// blocking. The deadline applies to all future I/O, not just
// the immediately following call to Read or Write.
//
// An idle timeout can be implemented by repeatedly extending
// the deadline after successful Read or Write calls.
//
// A zero value for t means I/O operations will not time out.
func (lc *LoopbackConn) SetDeadline(t time.Time) (err error) {
	return
}

// SetReadDeadline sets the deadline for future Read calls.
// A zero value for t means Read will not time out.
func (lc *LoopbackConn) SetReadDeadline(t time.Time) (err error) {
	return
}

// SetWriteDeadline sets the deadline for future Write calls.
// Even if write times out, it may return n > 0, indicating that
// some of the data was successfully written.
// A zero value for t means Write will not time out.
func (lc *LoopbackConn) SetWriteDeadline(t time.Time) (err error) {
	return
}

// Network returns the name of the network
func (la LoopbackAddr) Network() (s string) {
	return "loopback"
}

// String returns the string form of address
func (la LoopbackAddr) String() (s string) {
	return "0"
}
