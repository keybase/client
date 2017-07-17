// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

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

	// Protects closing of ch so that we can close ch
	// and set isClosed atomically.
	mutex    sync.Mutex
	ch       chan *LoopbackConn
	isClosed bool
}

// LoopbackConn implments the net.Conn interface but is used to loopback
// from a process to itself. It is goroutine safe.
type LoopbackConn struct {

	// wMutex protects isClosed and ch to protect against
	// double-closes, and writes after close. It protects the
	// writer, hence the 'w'.
	wMutex   sync.Mutex
	isClosed bool
	ch       chan<- []byte

	// rMutex Protects partnerCh and buf, to ensure that only
	// one Go routine is reading at a time. It protects the
	// reader hence the 'r'
	rMutex    sync.Mutex
	partnerCh <-chan []byte
	buf       bytes.Buffer
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
	aCh := make(chan []byte)
	bCh := make(chan []byte)
	a := &LoopbackConn{ch: aCh}
	b := &LoopbackConn{ch: bCh}
	a.partnerCh = bCh
	b.partnerCh = aCh
	return a, b
}

// LoopbackDial dials the given LoopbackListener and yields an new net.Conn
// that's a connection to it.
func (ll *LoopbackListener) Dial() (net.Conn, error) {
	G.Log.Debug("+ LoopbackListener.Dial")
	ll.mutex.Lock()
	defer ll.mutex.Unlock()
	if ll.isClosed {
		return nil, syscall.EINVAL
	}
	a, b := NewLoopbackConnPair()
	ll.ch <- a
	return b, nil
}

// Accept waits for and returns the next connection to the listener.
func (ll *LoopbackListener) Accept() (ret net.Conn, err error) {
	G.Log.Debug("+ LoopbackListener.Accept")
	var ok bool

	// We can't hold the lock (even if we had to) since that would
	// deadlock the process (to have the Accepter and Dialer contending
	// the same lock).
	if ret, ok = <-ll.ch; !ok {
		err = syscall.EINVAL
	}

	G.Log.Debug("- LoopbackListener.Accept -> %v", err)
	return ret, err
}

// Close closes the listener.
// Any blocked Accept operations will be unblocked and return errors
func (ll *LoopbackListener) Close() (err error) {
	ll.mutex.Lock()
	defer ll.mutex.Unlock()
	if ll.isClosed {
		return syscall.EINVAL
	}
	ll.isClosed = true
	close(ll.ch)
	return
}

// Addr returns the listener's network address.
func (ll *LoopbackListener) Addr() (addr net.Addr) {
	return LoopbackAddr{}
}

// Read reads data from the connection.
func (lc *LoopbackConn) Read(b []byte) (n int, err error) {
	lc.rMutex.Lock()
	defer lc.rMutex.Unlock()

	if lc.buf.Len() > 0 {
		return lc.buf.Read(b)
	}
	msg, ok := <-lc.partnerCh
	if !ok {
		return 0, io.EOF
	}
	lc.buf.Write(msg)
	return lc.buf.Read(b)
}

// Write writes data to the connection.
func (lc *LoopbackConn) Write(b []byte) (n int, err error) {
	lc.wMutex.Lock()
	defer lc.wMutex.Unlock()
	if lc.isClosed {
		return 0, syscall.EINVAL
	}
	lc.ch <- b
	return len(b), nil
}

// Close closes the connection.
// Any blocked Read or Write operations will be unblocked and return errors.
func (lc *LoopbackConn) Close() (err error) {
	lc.wMutex.Lock()
	defer lc.wMutex.Unlock()
	if lc.isClosed {
		return syscall.EINVAL
	}
	lc.isClosed = true
	close(lc.ch)
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
