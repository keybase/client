// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package rpc

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"io"
	"net"
	"sync"
	"time"

	"github.com/keybase/backoff"
	"github.com/keybase/go-framed-msgpack-rpc/rpc/resinit"
	"golang.org/x/net/context"
)

// DisconnectStatus is the connection information passed to
// ConnectionHandler.OnDisconnected().
type DisconnectStatus int

const (
	// skip 0
	_ = iota
	// UsingExistingConnection means that an existing
	// connection will be used.
	UsingExistingConnection DisconnectStatus = iota
	// StartingFirstConnection means that a connection will be
	// started, and this is the first one.
	StartingFirstConnection
	// StartingNonFirstConnection means that a connection will be
	// started, and this is not the first one.
	StartingNonFirstConnection
)

// Dialable is a custom interface that can be used to replace net.Dial inside this library if desired
// This is most likely useful for the purpose of routing connections through a proxy
type Dialable interface {
	// Set the timeout and keepalive options for this Dialable
	SetOpts(timeout time.Duration, keepAlive time.Duration)

	// Dial a connection to the given address
	Dial(ctx context.Context, network string, addr string) (net.Conn, error)
}

// ConnectionTransport is a container for an underlying transport to be
// used by a Connection instance.
type ConnectionTransport interface {
	// Dial is called to connect to the server.
	Dial(ctx context.Context) (Transporter, error)

	// IsConnected is called to check for connection status.
	IsConnected() bool

	// Finalize is used to indicate the result of Dial is complete.
	Finalize()

	// Close is used to close any open connection.
	Close()
}

type connTransport struct {
	uri                 *FMPURI
	instrumenterStorage NetworkInstrumenterStorage
	l                   LogFactory
	wef                 WrapErrorFunc
	maxFrameLength      int32
	dialable            Dialable
	conn                net.Conn
	transport           Transporter
	stagedTransport     Transporter
}

var _ ConnectionTransport = (*connTransport)(nil)

// NewConnectionTransport creates a ConnectionTransport for a given FMPURI.
func NewConnectionTransport(uri *FMPURI, l LogFactory, instrumenterStorage NetworkInstrumenterStorage,
	wef WrapErrorFunc, maxFrameLength int32) ConnectionTransport {
	return &connTransport{
		uri:                 uri,
		l:                   l,
		instrumenterStorage: instrumenterStorage,
		wef:                 wef,
		maxFrameLength:      maxFrameLength,
	}
}

// NewConnectionTransportWithDialable creates a ConnectionTransport for a given FMPURI via the given Dialable
func NewConnectionTransportWithDialable(uri *FMPURI, l LogFactory, instrumenterStorage NetworkInstrumenterStorage,
	wef WrapErrorFunc, maxFrameLength int32, dialable Dialable) ConnectionTransport {
	return &connTransport{
		uri:                 uri,
		l:                   l,
		instrumenterStorage: instrumenterStorage,
		wef:                 wef,
		maxFrameLength:      maxFrameLength,
		dialable:            dialable,
	}
}

func (t *connTransport) Dial(ctx context.Context) (Transporter, error) {
	var err error
	if t.conn != nil {
		t.conn.Close()
	}
	if t.dialable != nil {
		t.conn, err = t.dialable.Dial(ctx, "tcp", t.uri.HostPort)
	} else {
		t.conn, err = t.uri.Dial()
	}
	if err != nil {
		// If we get a DNS error, it could be because glibc has cached an old
		// version of /etc/resolv.conf. The res_init() libc function busts that
		// cache and keeps us from getting stuck in a state where DNS requests
		// keep failing even though the network is up. This is similar to what
		// the Rust standard library does:
		// https://github.com/rust-lang/rust/blob/028569ab1b/src/libstd/sys_common/net.rs#L186-L190
		// Note that we still propagate the error here, and we expect callers
		// to retry.
		resinit.ResInitIfDNSError(err)
		return nil, err
	}

	// Disable SIGPIPE on platforms that require it (Darwin). See sigpipe_bsd.go.
	if err = DisableSigPipe(t.conn); err != nil {
		return nil, err
	}

	if t.stagedTransport != nil {
		t.stagedTransport.Close()
	}
	t.stagedTransport = NewTransport(t.conn, t.l, t.instrumenterStorage, t.wef, t.maxFrameLength)
	return t.stagedTransport, nil
}

func (t *connTransport) IsConnected() bool {
	return t.transport != nil && t.transport.IsConnected()
}

func (t *connTransport) Finalize() {
	if t.transport != nil {
		t.transport.Close()
	}
	t.transport = t.stagedTransport
	t.stagedTransport = nil
}

func (t *connTransport) Close() {
	t.conn.Close()
	if t.transport != nil {
		t.transport.Close()
	}
	t.transport = nil
	if t.stagedTransport != nil {
		t.stagedTransport.Close()
	}
	t.stagedTransport = nil
}

// ConnectionHandler is the callback interface for interacting with the connection.
type ConnectionHandler interface {
	// OnConnect is called immediately after a connection has been
	// established.  An implementation would likely log something,
	// register served protocols, and/or perform authentication.
	OnConnect(context.Context, *Connection, GenericClient, *Server) error

	// OnConnectError is called whenever there is an error during connection.
	OnConnectError(err error, reconnectThrottleDuration time.Duration)

	// OnDoCommandError is called whenever there is an error during DoCommand
	OnDoCommandError(err error, nextTime time.Duration)

	// OnDisconnected is called whenever the connection notices it
	// is disconnected.
	OnDisconnected(ctx context.Context, status DisconnectStatus)

	// ShouldRetry is called whenever an error is returned by
	// an RPC function passed to Connection.DoCommand(), and
	// should return whether or not that error signifies that that
	// RPC should retried (with backoff)
	ShouldRetry(name string, err error) bool

	// ShouldRetryOnConnect is called whenever an error is returned
	// during connection establishment, and should return whether or
	// not the connection should be established again.
	ShouldRetryOnConnect(err error) bool

	// HandlerName returns a string representing the type of the connection
	// handler.
	HandlerName() string
}

// ConnectionTransportTLS is a ConnectionTransport implementation that
// uses TLS+rpc.
type ConnectionTransportTLS struct {
	rootCerts      []byte
	srvRemote      Remote
	tlsConfig      *tls.Config
	maxFrameLength int32
	dialable       Dialable

	// Protects everything below.
	mutex               sync.Mutex
	transport           Transporter
	stagedTransport     Transporter
	conn                net.Conn
	dialerTimeout       time.Duration
	handshakeTimeout    time.Duration
	instrumenterStorage NetworkInstrumenterStorage
	logFactory          LogFactory
	wef                 WrapErrorFunc
	log                 ConnectionLog
}

// Test that ConnectionTransportTLS fully implements the ConnectionTransport interface.
var _ ConnectionTransport = (*ConnectionTransportTLS)(nil)

const keepAlive = 10 * time.Second

// Dial is an implementation of the ConnectionTransport interface.
func (ct *ConnectionTransportTLS) Dial(ctx context.Context) (
	Transporter, error) {
	addr := ct.srvRemote.GetAddress()
	config := ct.tlsConfig
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}

	// If we didn't specify a tls.Config, but we did specify
	// explicit rootCerts, then populate a new tls.Config here.
	// Otherwise, we're using the defaults via `nil` tls.Config.
	if config == nil && ct.rootCerts != nil {
		// load CA certificate
		certs := x509.NewCertPool()
		if !certs.AppendCertsFromPEM(ct.rootCerts) {
			return nil, errors.New("Unable to load root certificates")
		}
		config = &tls.Config{
			RootCAs:    certs,
			ServerName: host,
		}
	}
	// Final check to make sure we have a TLS config since tls.Client requires
	// either ServerName or InsecureSkipVerify to be set.
	if config == nil {
		config = &tls.Config{ServerName: host}
	}

	ct.log.Debug("%s %s",
		LogField{Key: ConnectionLogMsgKey, Value: "Dialing"},
		LogField{Key: "remote-addr", Value: addr})
	// connect
	var baseConn net.Conn
	if ct.dialable != nil {
		ct.dialable.SetOpts(ct.dialerTimeout, keepAlive)
		baseConn, err = ct.dialable.Dial(ctx, "tcp", addr)
	} else {
		dialer := net.Dialer{
			Timeout:   ct.dialerTimeout,
			KeepAlive: keepAlive,
		}
		baseConn, err = dialer.DialContext(ctx, "tcp", addr)
	}

	if err != nil {
		// If we get a DNS error, it could be because glibc has cached an
		// old version of /etc/resolv.conf. The res_init() libc function
		// busts that cache and keeps us from getting stuck in a state
		// where DNS requests keep failing even though the network is up.
		// This is similar to what the Rust standard library does:
		// https://github.com/rust-lang/rust/blob/028569ab1b/src/libstd/sys_common/net.rs#L186-L190
		// Note that we still propagate the error here, and we expect
		// callers to retry.
		resinit.ResInitIfDNSError(err)
		return nil, err
	}
	ct.log.Debug("baseConn: %s; Calling %s",
		LogField{Key: "local-addr", Value: baseConn.LocalAddr()},
		LogField{Key: ConnectionLogMsgKey, Value: "Handshake"})
	conn := tls.Client(baseConn, config)

	// run TLS handshake with a timeout
	errCh := make(chan error, 1)
	go func() {
		errCh <- conn.Handshake()
	}()
	handshakeTimeout := ct.handshakeTimeout
	if handshakeTimeout == 0 {
		handshakeTimeout = time.Minute
	}
	select {
	case err := <-errCh:
		if err != nil {
			return nil, err
		}
	case <-time.After(handshakeTimeout):
		return nil, errors.New("handshake timeout")
	}
	ct.log.Debug("%s", LogField{Key: ConnectionLogMsgKey, Value: "Handshaken"})

	// Disable SIGPIPE on platforms that require it (Darwin). See sigpipe_bsd.go.
	err = DisableSigPipe(baseConn)
	if err != nil {
		return nil, err
	}

	ct.mutex.Lock()
	defer ct.mutex.Unlock()
	if ct.conn != nil {
		ct.conn.Close()
	}
	transport := NewTransport(conn, ct.logFactory, ct.instrumenterStorage, ct.wef, ct.maxFrameLength)
	ct.conn = conn
	if ct.stagedTransport != nil {
		ct.stagedTransport.Close()
	}
	ct.stagedTransport = transport
	return transport, nil
}

// IsConnected is an implementation of the ConnectionTransport interface.
func (ct *ConnectionTransportTLS) IsConnected() bool {
	ct.mutex.Lock()
	defer ct.mutex.Unlock()
	return ct.transport != nil && ct.transport.IsConnected()
}

// Finalize is an implementation of the ConnectionTransport interface.
func (ct *ConnectionTransportTLS) Finalize() {
	ct.mutex.Lock()
	defer ct.mutex.Unlock()
	if ct.transport != nil {
		ct.transport.Close()
	}
	ct.transport = ct.stagedTransport
	ct.stagedTransport = nil
	ct.srvRemote.Reset()
}

// Close is an implementation of the ConnectionTransport interface.
func (ct *ConnectionTransportTLS) Close() {
	ct.mutex.Lock()
	defer ct.mutex.Unlock()
	if ct.conn != nil {
		ct.conn.Close()
	}
	if ct.transport != nil {
		ct.transport.Close()
	}
	if ct.stagedTransport != nil {
		ct.stagedTransport.Close()
	}
}

type LogTagsFromContext func(ctx context.Context) (map[interface{}]string, bool)

// Connection encapsulates all client connection handling.
type Connection struct {
	handler          ConnectionHandler
	transport        ConnectionTransport
	errorUnwrapper   ErrorUnwrapper
	reconnectBackoff func() backoff.BackOff
	doCommandBackoff func() backoff.BackOff
	wef              WrapErrorFunc
	tagsFunc         LogTagsFromContext
	log              ConnectionLog
	protocols        []Protocol

	// protects everything below.
	mutex             sync.Mutex
	client            GenericClient
	server            *Server
	reconnectChan     chan struct{}
	reconnectErrPtr   *error             // Filled in with fatal reconnect err (if any) before reconnectChan is closed
	cancelFunc        context.CancelFunc // used to cancel the reconnect loop
	reconnectedBefore bool

	firstConnectDelayDuration     time.Duration
	initialReconnectBackoffWindow func() time.Duration
	connectDelayTimer             CancellableTimer

	// for tests
	reconnectCompleteForTest chan struct{}
}

// This struct contains all the connection parameters that are optional. The
// mandatory parameters are given as positional arguments to the different
// wrapper functions, along with this struct.
//
// The backoffs are functions that created backoff.BackOffs, rather
// than backoff instances, since some backoffs can be stateful and not
// goroutine-safe (e.g., backoff.Exponential).  Connection will call
// these functions once for each command call and reconnect attempt.
type ConnectionOpts struct {
	TagsFunc         LogTagsFromContext
	Protocols        []Protocol
	DontConnectNow   bool
	WrapErrorFunc    WrapErrorFunc
	ReconnectBackoff func() backoff.BackOff
	CommandBackoff   func() backoff.BackOff
	// FirstConnectDelayDuration, if it returns non zero, causes a random
	// backoff before the first connection. The random backoff timer is
	// fast-forward-able by passing in a WithFireNow(ctx) into a RPC call.
	FirstConnectDelayDuration time.Duration
	// InitialReconnectBackoffWindow, if it returns non zero, causes a random
	// backoff before reconnecting. The random backoff timer is
	// fast-forward-able by passing in a WithFireNow(ctx) into a RPC call.
	InitialReconnectBackoffWindow func() time.Duration
	// As the name suggests, we normally skip the "initial reconnect backoff"
	// the very first time we try to connect. However, some callers instantiate
	// new Connection objects after a disconnect, and they need the "first
	// connection" to be treated as a reconnect. If this is set,
	// FirstConnectDelayDuration is ineffective.
	ForceInitialBackoff bool
	// DialerTimeout is the Timeout used in net.Dialer when initiating new
	// connections. Zero value is passed as-is to net.Dialer, which means no
	// timeout. Note that OS may impose its own timeout.
	DialerTimeout time.Duration
	// HandshakeTimeout is a timeout on how long we wait for TLS handshake to
	// complete. If no value specified, we default to time.Minute.
	HandshakeTimeout time.Duration
}

// NewTLSConnectionWithConnectionLogFactory is like NewTLSConnection,
// but with a custom logger.
func NewTLSConnectionWithConnectionLogFactory(
	srvRemote Remote,
	rootCerts []byte,
	errorUnwrapper ErrorUnwrapper,
	handler ConnectionHandler,
	logFactory LogFactory,
	instrumenterStorage NetworkInstrumenterStorage,
	connectionLogFactory ConnectionLogFactory,
	maxFrameLength int32,
	opts ConnectionOpts,
) *Connection {
	transport := &ConnectionTransportTLS{
		rootCerts:           rootCerts,
		srvRemote:           srvRemote,
		maxFrameLength:      maxFrameLength,
		instrumenterStorage: instrumenterStorage,
		logFactory:          logFactory,
		wef:                 opts.WrapErrorFunc,
		dialerTimeout:       opts.DialerTimeout,
		handshakeTimeout:    opts.HandshakeTimeout,
		log:                 connectionLogFactory.Make("conn_tspt"),
	}
	connLog := connectionLogFactory.Make("conn")
	return newConnectionWithTransportAndProtocolsWithLog(
		handler, transport, errorUnwrapper, connLog, opts)
}

// NewTLSConnection returns a connection that tries to connect to the
// given server address with TLS.
func NewTLSConnection(
	srvRemote Remote,
	rootCerts []byte,
	errorUnwrapper ErrorUnwrapper,
	handler ConnectionHandler,
	logFactory LogFactory,
	instrumenterStorage NetworkInstrumenterStorage,
	logOutput LogOutputWithDepthAdder,
	maxFrameLength int32,
	opts ConnectionOpts,
) *Connection {
	transport := &ConnectionTransportTLS{
		rootCerts:           rootCerts,
		srvRemote:           srvRemote,
		maxFrameLength:      maxFrameLength,
		logFactory:          logFactory,
		instrumenterStorage: instrumenterStorage,
		wef:                 opts.WrapErrorFunc,
		dialerTimeout:       opts.DialerTimeout,
		handshakeTimeout:    opts.HandshakeTimeout,
		log:                 newConnectionLogUnstructured(logOutput, "CONNTSPT"),
	}
	return newConnectionWithTransportAndProtocols(handler, transport, errorUnwrapper, logOutput, opts)
}

// NewTLSConnectionWithTLSConfig allows you to specify a RootCA pool and also
// a serverName (if wanted) via the full Go TLS config object.
func NewTLSConnectionWithTLSConfig(
	srvRemote Remote,
	tlsConfig *tls.Config,
	errorUnwrapper ErrorUnwrapper,
	handler ConnectionHandler,
	logFactory LogFactory,
	instrumenterStorage NetworkInstrumenterStorage,
	logOutput LogOutputWithDepthAdder,
	maxFrameLength int32,
	opts ConnectionOpts,
) *Connection {
	transport := &ConnectionTransportTLS{
		srvRemote:           srvRemote,
		tlsConfig:           copyTLSConfig(tlsConfig),
		maxFrameLength:      maxFrameLength,
		logFactory:          logFactory,
		instrumenterStorage: instrumenterStorage,
		wef:                 opts.WrapErrorFunc,
		dialerTimeout:       opts.DialerTimeout,
		handshakeTimeout:    opts.HandshakeTimeout,
		log:                 newConnectionLogUnstructured(logOutput, "CONNTSPT"),
	}
	return newConnectionWithTransportAndProtocols(handler, transport, errorUnwrapper, logOutput, opts)
}

// NewTLSConnection returns a connection that tries to connect to the
// given server address with TLS.
func NewTLSConnectionWithDialable(
	srvRemote Remote,
	rootCerts []byte,
	errorUnwrapper ErrorUnwrapper,
	handler ConnectionHandler,
	logFactory LogFactory,
	instrumenterStorage NetworkInstrumenterStorage,
	logOutput LogOutputWithDepthAdder,
	maxFrameLength int32,
	opts ConnectionOpts,
	dialable Dialable,
) *Connection {
	transport := &ConnectionTransportTLS{
		rootCerts:           rootCerts,
		srvRemote:           srvRemote,
		maxFrameLength:      maxFrameLength,
		logFactory:          logFactory,
		instrumenterStorage: instrumenterStorage,
		wef:                 opts.WrapErrorFunc,
		dialerTimeout:       opts.DialerTimeout,
		handshakeTimeout:    opts.HandshakeTimeout,
		log:                 newConnectionLogUnstructured(logOutput, "CONNTSPT"),
		dialable:            dialable,
	}
	return newConnectionWithTransportAndProtocols(handler, transport, errorUnwrapper, logOutput, opts)
}

// NewConnectionWithTransport allows for connections with a custom
// transport.
func NewConnectionWithTransport(
	handler ConnectionHandler,
	transport ConnectionTransport,
	errorUnwrapper ErrorUnwrapper,
	logOutput LogOutputWithDepthAdder,
	opts ConnectionOpts,
) *Connection {
	return newConnectionWithTransportAndProtocols(handler, transport, errorUnwrapper, logOutput, opts)
}

func newConnectionWithTransportAndProtocolsWithLog(handler ConnectionHandler,
	transport ConnectionTransport, errorUnwrapper ErrorUnwrapper,
	log ConnectionLog, opts ConnectionOpts) *Connection {
	// use exponential backoffs by default which never give up on reconnecting
	defaultBackoff := func() backoff.BackOff {
		b := backoff.NewExponentialBackOff()
		b.MaxElapsedTime = 0
		b.MaxInterval = 10 * time.Second
		return b
	}
	reconnectBackoff := opts.ReconnectBackoff
	if reconnectBackoff == nil {
		reconnectBackoff = defaultBackoff
	}
	commandBackoff := opts.CommandBackoff
	if commandBackoff == nil {
		commandBackoff = defaultBackoff
	}
	connection := &Connection{
		handler:                       handler,
		transport:                     transport,
		errorUnwrapper:                errorUnwrapper,
		reconnectBackoff:              reconnectBackoff,
		doCommandBackoff:              commandBackoff,
		firstConnectDelayDuration:     opts.FirstConnectDelayDuration,
		initialReconnectBackoffWindow: opts.InitialReconnectBackoffWindow,
		wef:                           opts.WrapErrorFunc,
		tagsFunc:                      opts.TagsFunc,
		log:                           log,
		protocols:                     opts.Protocols,
		reconnectedBefore:             opts.ForceInitialBackoff,
	}
	if !opts.DontConnectNow {
		// start connecting now
		connection.getReconnectChan()
	}
	return connection
}

func newConnectionWithTransportAndProtocols(handler ConnectionHandler,
	transport ConnectionTransport, errorUnwrapper ErrorUnwrapper,
	log LogOutputWithDepthAdder, opts ConnectionOpts) *Connection {
	return newConnectionWithTransportAndProtocolsWithLog(
		handler, transport, errorUnwrapper,
		newConnectionLogUnstructured(log, "CONN "+handler.HandlerName()), opts)
}

func (c *Connection) setReconnectCompleteForTest(ch chan struct{}) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.reconnectCompleteForTest = ch
}

// connect performs the actual connect() and rpc setup.
func (c *Connection) connect(ctx context.Context) error {
	c.log.Debug("Connection: %s",
		LogField{Key: ConnectionLogMsgKey, Value: "dialing transport"})

	// connect
	transport, err := c.transport.Dial(ctx)
	if err != nil {
		c.log.Warning("Connection: error %s: %v",
			LogField{Key: ConnectionLogMsgKey, Value: "dialing transport"},
			LogField{Key: "error", Value: err})
		return err
	}

	client := NewClient(transport, c.errorUnwrapper, c.tagsFunc)
	server := NewServer(transport, c.wef)

	for _, p := range c.protocols {
		if err := server.Register(p); err != nil {
			return err
		}
	}

	// call the connect handler
	c.log.Debug("Connection: %s", LogField{Key: ConnectionLogMsgKey, Value: "calling OnConnect"})
	err = c.handler.OnConnect(ctx, c, client, server)
	if err != nil {
		c.log.Warning("Connection: error calling %s handler: %v",
			LogField{Key: ConnectionLogMsgKey, Value: "OnConnect"},
			LogField{Key: "error", Value: err})
		return err
	}

	// set the client for other callers.
	// we wait to do this so the handler has time to do
	// any setup required, e.g. authenticate.
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.client = client
	c.server = server
	c.transport.Finalize()

	c.log.Debug("Connection: %s", LogField{Key: ConnectionLogMsgKey, Value: "connected"})
	return nil
}

// DoCommand executes the specific rpc command wrapped in rpcFunc.
func (c *Connection) DoCommand(ctx context.Context, name string, timeout time.Duration,
	rpcFunc func(GenericClient) error) error {
	if timeout > 0 {
		var timeoutCancel context.CancelFunc
		ctx, timeoutCancel = context.WithTimeout(ctx, timeout)
		defer timeoutCancel()
	}
	for {
		if (c.firstConnectDelayDuration != 0 ||
			c.initialReconnectBackoffWindow != nil) && isWithFireNow(ctx) {
			c.connectDelayTimer.FireNow()
		}

		// we may or may not be in the process of reconnecting.
		// if so we'll block here unless canceled by the caller.
		connErr := c.waitForConnection(ctx, false)
		if connErr != nil {
			return connErr
		}

		var rpcErr error

		// retry throttle errors w/backoff
		throttleErr := backoff.RetryNotify(func() error {
			rawClient := func() GenericClient {
				c.mutex.Lock()
				defer c.mutex.Unlock()
				return c.client
			}()
			// try the rpc call, assuming that it exits
			// immediately when ctx is canceled. will
			// retry connectivity errors w/backoff.
			throttleErr := rpcFunc(rawClient)
			if throttleErr != nil && c.handler.ShouldRetry(name, throttleErr) {
				return throttleErr
			}
			rpcErr = throttleErr
			return nil
		}, c.doCommandBackoff(), c.handler.OnDoCommandError)

		// RetryNotify gave up.
		if throttleErr != nil {
			return throttleErr
		}

		// check to see if we need to retry it.
		if !c.checkForRetry(rpcErr) {
			return rpcErr
		}
	}
}

// Blocks until a connnection is ready for use or the context is canceled.
func (c *Connection) waitForConnection(
	ctx context.Context, forceReconnect bool) error {
	reconnectChan, disconnectStatus, reconnectErrPtr, wait :=
		func() (chan struct{}, DisconnectStatus, *error, bool) {
			c.mutex.Lock()
			defer c.mutex.Unlock()
			if !forceReconnect && c.isConnectedLocked() {
				// already connected
				return nil, UsingExistingConnection, nil, false
			}
			// kick-off a connection and wait for it to complete
			// or for the caller to cancel.
			reconnectChan, disconnectStatus, reconnectErrPtr :=
				c.getReconnectChanLocked()
			return reconnectChan, disconnectStatus, reconnectErrPtr, true
		}()
	if !wait {
		return nil
	}
	c.log.Debug("Connection: %s; status: %d",
		LogField{Key: ConnectionLogMsgKey, Value: "waitForConnection"},
		LogField{Key: "disconnectStatus", Value: disconnectStatus})
	select {
	case <-ctx.Done():
		// caller canceled
		return ctx.Err()
	case <-reconnectChan:
		// Reconnect complete.  If something unretriable happened to
		// shut down the connection, this will be non-nil.
		return *reconnectErrPtr
	}
}

func (c *Connection) ForceReconnect(ctx context.Context) error {
	return c.waitForConnection(ctx, true)
}

// Returns true if the error indicates we should retry the command.
func (c *Connection) checkForRetry(err error) bool {
	return err == io.EOF
}

func (c *Connection) isConnectedLocked() bool {
	return c.transport.IsConnected() && c.client != nil
}

// IsConnected returns true if the connection is connected.  The mutex
// must not be held by the caller.
func (c *Connection) IsConnected() bool {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	return c.isConnectedLocked()
}

// This will either kick-off a new reconnection attempt or wait for an
// existing attempt. Returns the channel associated with an attempt,
// and whether or not a new one was created.  If a fatal error
// happens, reconnectErrPtr will be filled in before reconnectChan is
// closed.
func (c *Connection) getReconnectChanLocked() (
	reconnectChan chan struct{}, disconnectStatus DisconnectStatus,
	reconnectErrPtr *error) {
	c.log.Debug("Connection: %s",
		LogField{Key: ConnectionLogMsgKey, Value: "getReconnectChan"})
	if c.reconnectChan == nil {
		var ctx context.Context
		// for canceling the reconnect loop via Shutdown()
		ctx, c.cancelFunc = context.WithCancel(context.Background())
		c.reconnectChan = make(chan struct{})
		c.reconnectErrPtr = new(error)
		if c.reconnectedBefore {
			disconnectStatus = StartingNonFirstConnection
		} else {
			disconnectStatus = StartingFirstConnection
			c.reconnectedBefore = true
		}
		go c.doReconnect(ctx, disconnectStatus, c.reconnectChan, c.reconnectErrPtr)
	} else {
		disconnectStatus = UsingExistingConnection
	}
	return c.reconnectChan, disconnectStatus, c.reconnectErrPtr
}

func (c *Connection) getReconnectChan() (
	reconnectChan chan struct{}, disconnectStatus DisconnectStatus,
	reconnectErrPtr *error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	return c.getReconnectChanLocked()
}

// doReconnect attempts a reconnection.  It assumes that reconnectChan
// and reconnectErrPtr are the same ones in c, but are passed in to
// avoid having to take the mutex at the beginning of the method.
func (c *Connection) doReconnect(ctx context.Context, disconnectStatus DisconnectStatus,
	reconnectChan chan struct{}, reconnectErrPtr *error) {
	// inform the handler of our disconnected state
	c.handler.OnDisconnected(ctx, disconnectStatus)
	if c.firstConnectDelayDuration != 0 &&
		disconnectStatus == StartingFirstConnection {
		c.connectDelayTimer.StartConstant(c.firstConnectDelayDuration)
		c.log.Debug("starting %s: %s",
			LogField{
				Key: ConnectionLogMsgKey, Value: "initial connect backoff"},
			LogField{Key: "duration", Value: c.firstConnectDelayDuration})
		c.connectDelayTimer.Wait()
		c.log.Debug("%s!", LogField{
			Key: ConnectionLogMsgKey, Value: "initial connect backoff done"})
	} else if c.initialReconnectBackoffWindow != nil &&
		disconnectStatus == StartingNonFirstConnection {
		waitDur := c.connectDelayTimer.StartRandom(c.initialReconnectBackoffWindow())
		c.log.Debug("starting random %s: %s",
			LogField{
				Key: ConnectionLogMsgKey, Value: "initial reconnect backoff"},
			LogField{Key: "duration", Value: waitDur})
		c.connectDelayTimer.Wait()
		c.log.Debug("%s!", LogField{
			Key: ConnectionLogMsgKey, Value: "initial reconnect backoff done"})
	}
	c.log.Debug("RetryNotify %s", LogField{Key: ConnectionLogMsgKey, Value: "beginning"})
	err := backoff.RetryNotifyWithContext(ctx, func() (err error) {
		c.log.Debug("RetryNotify %s", LogField{Key: ConnectionLogMsgKey, Value: "attempt"})
		defer func() {
			c.log.Debug("RetryNotify operation result: %v", LogField{Key: ConnectionLogMsgKey, Value: err})
		}()
		// try to connect
		err = c.connect(ctx)
		select {
		case <-ctx.Done():
			// context was canceled by Shutdown() or a user action
			*reconnectErrPtr = ctx.Err()
			c.log.Debug("RetryNotify context canceled: %s", LogField{Key: ConnectionLogMsgKey, Value: ctx.Err()})
			// short-circuit Retry
			return nil
		default:
		}
		if !c.handler.ShouldRetryOnConnect(err) {
			// A fatal error happened.
			*reconnectErrPtr = err
			c.log.Debug("RetryNotify ShouldRetryOnConnect: %v", LogField{Key: ConnectionLogMsgKey, Value: err})
			// short-circuit Retry
			return nil
		}
		return err
	}, c.reconnectBackoff(),
		// give the caller a chance to log any other error or adjust state
		c.handler.OnConnectError)
	c.log.Debug("RetryNotify complete %v", LogField{Key: ConnectionLogMsgKey, Value: err})

	if err != nil {
		// this shouldn't happen, but just in case.
		*reconnectErrPtr = err
	}

	// close the reconnect channel to signal we're connected.
	c.mutex.Lock()
	defer c.mutex.Unlock()
	close(reconnectChan)
	c.reconnectChan = nil
	c.cancelFunc = nil
	c.reconnectErrPtr = nil
	if c.reconnectCompleteForTest != nil {
		close(c.reconnectCompleteForTest)
		c.reconnectCompleteForTest = nil
	}
}

// GetClient returns an RPC client that uses DoCommand() for RPC
// calls, and thus handles throttling, disconnections, etc.
func (c *Connection) GetClient() GenericClient {
	return connectionClient{c}
}

// GetServer is called to retrieve an rpc server suitable for use by the caller.
func (c *Connection) GetServer() *Server {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	return c.server
}

// Shutdown cancels any reconnect loop in progress.
// Calling this invalidates the connection object.
func (c *Connection) Shutdown() {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	// cancel any reconnect loop
	if c.cancelFunc != nil {
		c.cancelFunc()
	}
	if c.transport != nil && c.transport.IsConnected() {
		// close the connection
		c.transport.Close()
	}
}

// FastForwardConnectDelayTimer causes any pending reconnect to happen
// immediately.
func (c *Connection) FastForwardConnectDelayTimer() {
	c.connectDelayTimer.FireNow()
}

type connectionClient struct {
	conn *Connection
}

var _ GenericClient = connectionClient{}

func (c connectionClient) Call(ctx context.Context, s string, args interface{},
	res interface{}, timeout time.Duration) error {
	return c.conn.DoCommand(ctx, s, timeout, func(rawClient GenericClient) error {
		return rawClient.Call(ctx, s, args, res, timeout)
	})
}

func (c connectionClient) CallCompressed(ctx context.Context, s string,
	args interface{}, res interface{}, ctype CompressionType, timeout time.Duration) error {
	return c.conn.DoCommand(ctx, s, timeout, func(rawClient GenericClient) error {
		return rawClient.CallCompressed(ctx, s, args, res, ctype, timeout)
	})
}

func (c connectionClient) Notify(ctx context.Context, s string, args interface{},
	timeout time.Duration) error {
	return c.conn.DoCommand(ctx, s, timeout, func(rawClient GenericClient) error {
		return rawClient.Notify(ctx, s, args, timeout)
	})
}
