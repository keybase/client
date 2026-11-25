// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"context"
	"errors"
	"io"
	"net"
	"sync"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// noopNotifySession answers session notification Calls so a serial
// send queue is not stuck waiting for a response. loggedIn is a Call
// (not a Notify) in the protocol.
type noopNotifySession struct{}

func (noopNotifySession) LoggedOut(context.Context) error { return nil }
func (noopNotifySession) LoggedIn(context.Context, keybase1.LoggedInArg) error {
	return nil
}

func (noopNotifySession) ClientOutOfDate(context.Context, keybase1.ClientOutOfDateArg) error {
	return nil
}

func (noopNotifySession) SessionChanged(context.Context, keybase1.BootstrapStatus) error {
	return nil
}

// NotifyRecorder is a connection registered with a NotifyRouter, for tests.
// It records the notifications and calls sent to it in the order they were
// written: each is decoded inside the transport's Write, so it is recorded
// before the send returns.
type NotifyRecorder struct {
	ID        ConnectionID
	conn      *recorderConn
	server    net.Conn
	closed    chan error
	closeOnce sync.Once
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
// keybase1.LoggedInArg.
func (r RecordedNotify) Decode(v any) error {
	return codec.NewDecoderBytes(r.arg, newRecorderHandle()).Decode(v)
}

// NewNotifyRecorder adds a connection to g's router and registers it for the
// given channels.
func NewNotifyRecorder(g *GlobalContext, channels keybase1.NotificationChannels) *NotifyRecorder {
	client, server := net.Pipe()
	conn := &recorderConn{Conn: client}
	xp := rpc.NewTransport(conn, NewRPCLogFactory(g), g.LocalNetworkInstrumenterStorage,
		MakeWrapError(g), rpc.DefaultMaxFrameLength)
	closed := make(chan error, 1)

	// Serve the far end of the pipe so Call-style notifications (loggedIn)
	// get a response and a serial send queue can proceed.
	srvXP := rpc.NewTransport(server, NewRPCLogFactory(g), g.LocalNetworkInstrumenterStorage,
		MakeWrapError(g), rpc.DefaultMaxFrameLength)
	srv := rpc.NewServer(srvXP, MakeWrapError(g))
	if err := srv.Register(keybase1.NotifySessionProtocol(noopNotifySession{})); err != nil {
		panic(err)
	}
	srv.Run()

	id := g.NotifyRouter.AddConnection(xp, closed)
	g.NotifyRouter.SetChannels(id, channels)
	return &NotifyRecorder{ID: id, conn: conn, server: server, closed: closed}
}

// Messages returns what has been recorded so far, oldest first.
func (r *NotifyRecorder) Messages() []RecordedNotify {
	r.conn.mu.Lock()
	defer r.conn.mu.Unlock()
	return append([]RecordedNotify(nil), r.conn.msgs...)
}

// Close closes the connection, which removes it from the router. It is safe
// to call more than once.
func (r *NotifyRecorder) Close() {
	r.closeOnce.Do(func() {
		_ = r.conn.Close()
		_ = r.server.Close()
		r.closed <- io.EOF
	})
}

type recorderConn struct {
	net.Conn
	mu   sync.Mutex
	msgs []RecordedNotify
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
	method, ok := frame[1].(string)
	if !ok || method == "" {
		return c.Conn.Write(b)
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
	return c.Conn.Write(b)
}
