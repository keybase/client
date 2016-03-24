package rpc

import (
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"time"

	"github.com/cenkalti/backoff"
	"golang.org/x/net/context"
)

// DisconnectStatus is the connection information passed to
// ConnectionHandler.OnDisconnected().
type DisconnectStatus int

const (
	// UsingExistingConnection means that an existing
	// connection will be used.
	UsingExistingConnection = 1
	// StartingFirstConnection means that a connection will be
	// started, and this is the first one.
	StartingFirstConnection = iota
	// StartingNonFirstConnection means that a connection will be
	// started, and this is not the first one.
	StartingNonFirstConnection DisconnectStatus = iota
)

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
	rootCerts []byte
	srvAddr   string

	// Protects everything below.
	mutex           sync.Mutex
	transport       Transporter
	stagedTransport Transporter
	conn            net.Conn
	logFactory      LogFactory
	wef             WrapErrorFunc
}

// Test that ConnectionTransportTLS fully implements the ConnectionTransport interface.
var _ ConnectionTransport = (*ConnectionTransportTLS)(nil)

// Dial is an implementation of the ConnectionTransport interface.
func (ct *ConnectionTransportTLS) Dial(ctx context.Context) (
	Transporter, error) {
	var conn net.Conn
	err := runUnlessCanceled(ctx, func() error {
		// load CA certificate
		certs := x509.NewCertPool()
		if !certs.AppendCertsFromPEM(ct.rootCerts) {
			return errors.New("Unable to load root certificates")
		}
		// connect
		config := tls.Config{RootCAs: certs}
		var err error
		conn, err = tls.DialWithDialer(&net.Dialer{
			KeepAlive: 10 * time.Second,
		}, "tcp", ct.srvAddr, &config)
		return err
	})
	if err != nil {
		return nil, err
	}

	ct.mutex.Lock()
	defer ct.mutex.Unlock()
	transport := NewTransport(conn, ct.logFactory, ct.wef)
	ct.conn = conn
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
	ct.transport = ct.stagedTransport
	ct.stagedTransport = nil
}

// Close is an implementation of the ConnectionTransport interface.
func (ct *ConnectionTransportTLS) Close() {
	ct.mutex.Lock()
	defer ct.mutex.Unlock()
	if ct.conn != nil {
		ct.conn.Close()
	}
}

type LogTagsFromContext func(ctx context.Context) (map[interface{}]string, bool)

type connectionLog struct {
	LogOutput
	logPrefix string
}

func (l *connectionLog) Warning(format string, params ...interface{}) {
	l.LogOutput.Warning("(%s) %s", l.logPrefix, fmt.Sprintf(format, params...))
}

func (l *connectionLog) Debug(format string, params ...interface{}) {
	l.LogOutput.Debug("(%s) %s", l.logPrefix, fmt.Sprintf(format, params...))
}

// Connection encapsulates all client connection handling.
type Connection struct {
	srvAddr          string
	handler          ConnectionHandler
	transport        ConnectionTransport
	errorUnwrapper   ErrorUnwrapper
	reconnectBackoff *backoff.ExponentialBackOff
	doCommandBackoff *backoff.ExponentialBackOff
	wef              WrapErrorFunc
	tagsFunc         LogTagsFromContext
	log              connectionLog

	// protects everything below.
	mutex             sync.Mutex
	client            GenericClient
	server            *Server
	reconnectChan     chan struct{}
	reconnectErrPtr   *error             // Filled in with fatal reconnect err (if any) before reconnectChan is closed
	cancelFunc        context.CancelFunc // used to cancel the reconnect loop
	reconnectedBefore bool
}

// NewTLSConnection returns a connection that tries to connect to the
// given server address with TLS.
func NewTLSConnection(srvAddr string, rootCerts []byte,
	errorUnwrapper ErrorUnwrapper, handler ConnectionHandler,
	connectNow bool, l LogFactory, wef WrapErrorFunc, log LogOutput,
	tagsFunc LogTagsFromContext) *Connection {
	transport := &ConnectionTransportTLS{
		rootCerts:  rootCerts,
		srvAddr:    srvAddr,
		logFactory: l,
		wef:        wef,
	}
	return NewConnectionWithTransport(handler, transport, errorUnwrapper,
		connectNow, wef, log, tagsFunc)
}

// NewConnectionWithTransport allows for connections with a custom
// transport.
func NewConnectionWithTransport(handler ConnectionHandler,
	transport ConnectionTransport, errorUnwrapper ErrorUnwrapper,
	connectNow bool, wef WrapErrorFunc, log LogOutput,
	tagsFunc LogTagsFromContext) *Connection {
	// retry w/exponential backoff
	reconnectBackoff := backoff.NewExponentialBackOff()
	// never give up reconnecting
	reconnectBackoff.MaxElapsedTime = 0
	randBytes := make([]byte, 4)
	rand.Read(randBytes)
	connectionPrefix := fmt.Sprintf("CONN %s %x", handler.HandlerName(),
		randBytes)
	connection := &Connection{
		handler:          handler,
		transport:        transport,
		errorUnwrapper:   errorUnwrapper,
		reconnectBackoff: reconnectBackoff,
		doCommandBackoff: backoff.NewExponentialBackOff(),
		tagsFunc:         tagsFunc,
		log: connectionLog{
			LogOutput: log,
			logPrefix: connectionPrefix,
		},
	}
	if connectNow {
		// start connecting now
		connection.getReconnectChan()
	}
	return connection
}

// connect performs the actual connect() and rpc setup.
func (c *Connection) connect(ctx context.Context) error {
	c.log.Debug("Connection: dialing transport")

	// connect
	transport, err := c.transport.Dial(ctx)
	if err != nil {
		c.log.Warning("Connection: error dialing transport: %#v", err)
		return err
	}

	client := NewClient(transport, c.errorUnwrapper)
	server := NewServer(transport, c.wef)

	// call the connect handler
	err = c.handler.OnConnect(ctx, c, client, server)
	if err != nil {
		c.log.Warning("Connection: error calling OnConnect handler: %#v", err)
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

	c.log.Debug("Connection: connected")
	return nil
}

// DoCommand executes the specific rpc command wrapped in rpcFunc.
func (c *Connection) DoCommand(ctx context.Context, name string,
	rpcFunc func(GenericClient) error) error {
	for {
		// we may or may not be in the process of reconnecting.
		// if so we'll block here unless canceled by the caller.
		connErr := c.waitForConnection(ctx)
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
			// try the rpc call. this can also be canceled
			// by the caller, and will retry connectivity
			// errors w/backoff.
			throttleErr := runUnlessCanceled(ctx, func() error {
				return rpcFunc(rawClient)
			})
			if throttleErr != nil && c.handler.ShouldRetry(name, throttleErr) {
				return throttleErr
			}
			rpcErr = throttleErr
			return nil
		}, c.doCommandBackoff, c.handler.OnDoCommandError)

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
func (c *Connection) waitForConnection(ctx context.Context) error {
	if c.IsConnected() {
		// already connected
		return nil
	}
	// kick-off a connection and wait for it to complete
	// or for the caller to cancel.
	reconnectChan, disconnectStatus, reconnectErrPtr := c.getReconnectChan()
	c.log.Debug("Connection: waitForConnection; status: %d", disconnectStatus)
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

// Returns true if the error indicates we should retry the command.
func (c *Connection) checkForRetry(err error) bool {
	return err == io.EOF
}

// IsConnected returns true if the connection is connected.  The mutex
// must not be held by the caller.
func (c *Connection) IsConnected() bool {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	return c.transport.IsConnected() && c.client != nil
}

// This will either kick-off a new reconnection attempt or wait for an
// existing attempt. Returns the channel associated with an attempt,
// and whether or not a new one was created.  If a fatal error
// happens, reconnectErrPtr will be filled in before reconnectChan is
// closed.
func (c *Connection) getReconnectChan() (
	reconnectChan chan struct{}, disconnectStatus DisconnectStatus,
	reconnectErrPtr *error) {
	c.log.Debug("Connection: getReconnectChan")
	c.mutex.Lock()
	defer c.mutex.Unlock()
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

// doReconnect attempts a reconnection.  It assumes that reconnectChan
// and reconnectErrPtr are the same ones in c, but are passed in to
// avoid having to take the mutex at the beginning of the method.
func (c *Connection) doReconnect(ctx context.Context, disconnectStatus DisconnectStatus,
	reconnectChan chan struct{}, reconnectErrPtr *error) {
	// inform the handler of our disconnected state
	c.handler.OnDisconnected(ctx, disconnectStatus)
	err := backoff.RetryNotify(func() error {
		// try to connect
		err := c.connect(ctx)
		select {
		case <-ctx.Done():
			// context was canceled by Shutdown() or a user action
			*reconnectErrPtr = ctx.Err()
			// short-circuit Retry
			return nil
		default:
		}
		if !c.handler.ShouldRetryOnConnect(err) {
			// A fatal error happened.
			*reconnectErrPtr = err
			// short-circuit Retry
			return nil
		}
		return err
	}, c.reconnectBackoff,
		// give the caller a chance to log any other error or adjust state
		c.handler.OnConnectError)

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

type connectionClient struct {
	conn *Connection
}

var _ GenericClient = connectionClient{}

func (c connectionClient) Call(ctx context.Context, s string, args interface{}, res interface{}) error {
	return c.conn.DoCommand(ctx, s, func(rawClient GenericClient) error {
		tags, ok := c.conn.tagsFunc(ctx)
		if ok {
			rpcTags := make(CtxRpcTags)
			for key, tagName := range tags {
				if v := ctx.Value(key); v != nil {
					rpcTags[tagName] = v
				}
			}
			ctx = AddRpcTagsToContext(ctx, rpcTags)
		}
		return rawClient.Call(ctx, s, args, res)
	})
}

func (c connectionClient) Notify(ctx context.Context, s string, args interface{}) error {
	return c.conn.DoCommand(ctx, s, func(rawClient GenericClient) error {
		rawClient.Notify(ctx, s, args)
		return nil
	})
}
