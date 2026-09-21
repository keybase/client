// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"context"
	"errors"
	"io"
	"net"
	"sync"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// NotifyRecorder is a connection registered with a NotifyRouter, for tests.
// It records the notifications and calls sent to it in the order they were
// written: each is decoded inside the transport's Write, so it is recorded
// before the send returns. It never answers a call. A Go rpc.Server on the
// far end would serve each notification on its own goroutine and lose that
// order.
type NotifyRecorder struct {
	ID     ConnectionID
	router *NotifyRouter
	conn   *recorderConn
	closed chan error
}

// RecordedNotify is one notification or call a NotifyRecorder saw.
type RecordedNotify struct {
	Method string
	arg    []byte
}

func newRecorderHandle() *codec.MsgpackHandle {
	return &codec.MsgpackHandle{WriteExt: true, RawToString: true}
}

// Decode decodes the message's single argument, e.g. into a
// keybase1.ClientStateArg.
func (r RecordedNotify) Decode(v any) error {
	return codec.NewDecoderBytes(r.arg, newRecorderHandle()).Decode(v)
}

// NewNotifyRecorder adds a connection to g's router and registers it for the
// given channels.
func NewNotifyRecorder(g *GlobalContext, channels keybase1.NotificationChannels) *NotifyRecorder {
	conn := &recorderConn{readDone: make(chan struct{})}
	xp := rpc.NewTransport(conn, NewRPCLogFactory(g), g.LocalNetworkInstrumenterStorage,
		MakeWrapError(g), rpc.DefaultMaxFrameLength)
	closed := make(chan error, 1)
	// runs the transport's reader, as the service does, so that closing the
	// connection fails the calls that were never answered
	rpc.NewServer(xp, MakeWrapError(g)).Run()
	id := g.NotifyRouter.AddConnection(xp, closed)
	g.NotifyRouter.SetChannels(id, channels)
	return &NotifyRecorder{ID: id, router: g.NotifyRouter, conn: conn, closed: closed}
}

const recorderFlushMethod = "keybase.1.NotifyRecorder.flush"

// Flush waits until everything queued to this connection so far has been
// written. It queues a marker notification and waits for its send, which
// returns only once the connection's single writer has written it, and so
// everything ahead of it.
func (r *NotifyRecorder) Flush() {
	n := r.router
	done := make(chan struct{})
	n.Lock()
	s := n.senders[r.ID]
	if s != nil {
		s.enqueue(func(xp rpc.Transporter) {
			defer close(done)
			_ = rpc.NewClient(xp, nil, nil).Notify(context.Background(), recorderFlushMethod, []any{}, 0)
		})
	}
	n.Unlock()
	if s == nil {
		return
	}
	select {
	case <-done:
	case <-s.stop:
	}
}

// Messages returns what has been recorded so far, oldest first.
func (r *NotifyRecorder) Messages() []RecordedNotify {
	r.conn.mu.Lock()
	defer r.conn.mu.Unlock()
	return append([]RecordedNotify(nil), r.conn.msgs...)
}

// Close closes the connection, which removes it from the router.
func (r *NotifyRecorder) Close() {
	_ = r.conn.Close()
	r.closed <- io.EOF
}

type recorderConn struct {
	mu        sync.Mutex
	msgs      []RecordedNotify
	closeOnce sync.Once
	readDone  chan struct{}
}

var _ net.Conn = (*recorderConn)(nil)

// Write gets exactly one frame per call: the rpc encoder writes each frame, its
// length prefix included, in a single Write.
func (c *recorderConn) Write(b []byte) (int, error) {
	dec := codec.NewDecoderBytes(b, newRecorderHandle())
	var length int
	var frame []any
	if err := dec.Decode(&length); err != nil {
		return 0, err
	}
	if err := dec.Decode(&frame); err != nil {
		return 0, err
	}
	// a notification is [2, method, args, tags?]; a call is [0, seqid, method, args, tags?]
	if len(frame) > 1 {
		if _, isMethod := frame[1].(string); !isMethod {
			frame = append(frame[:1], frame[2:]...)
		}
	}
	if len(frame) < 3 {
		return 0, errors.New("NotifyRecorder: not a call or a notification")
	}
	method, _ := frame[1].(string)
	if method == recorderFlushMethod {
		return len(b), nil
	}
	args, _ := frame[2].([]any)
	var arg []byte
	if len(args) > 0 {
		if err := codec.NewEncoderBytes(&arg, newRecorderHandle()).Encode(args[0]); err != nil {
			return 0, err
		}
	}
	c.mu.Lock()
	c.msgs = append(c.msgs, RecordedNotify{Method: method, arg: arg})
	c.mu.Unlock()
	return len(b), nil
}

func (c *recorderConn) Read([]byte) (int, error) {
	<-c.readDone
	return 0, io.EOF
}

func (c *recorderConn) Close() error {
	c.closeOnce.Do(func() { close(c.readDone) })
	return nil
}

func (c *recorderConn) LocalAddr() net.Addr              { return nil }
func (c *recorderConn) RemoteAddr() net.Addr             { return nil }
func (c *recorderConn) SetDeadline(time.Time) error      { return nil }
func (c *recorderConn) SetReadDeadline(time.Time) error  { return nil }
func (c *recorderConn) SetWriteDeadline(time.Time) error { return nil }
