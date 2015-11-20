package libkbfs

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"io"
	"net"
	"sync"
	"time"

	"github.com/cenkalti/backoff"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

// ConnectionHandler is the callback interface for interacting with the connection.
type ConnectionHandler interface {
	// OnConnect is called immediately after a connection has been
	// established.  An implementation would likely log something,
	// register served protocols, and/or perform authentication.
	OnConnect(context.Context, *Connection, keybase1.GenericClient, *rpc.Server) error

	// OnConnectError is called whenever there is an error during connection.
	OnConnectError(err error, reconnectThrottleDuration time.Duration)

	// OnDoCommandError is called whenever there is an error during DoCommand
	OnDoCommandError(err error, nextTime time.Duration)

	// OnDisconnected is called whenever the connection notices it is disconnected.
	OnDisconnected()

	// ShouldThrottle is called whenever an error is returned by
	// an RPC function passed to Connection.DoCommand(), and
	// should return whether or not that error signifies that that
	// RPC is throttled.
	ShouldThrottle(error) bool
}

// ConnectionTransportTLS is a ConnectionTransport implementation that uses TLS+rpc.
type ConnectionTransportTLS struct {
	config  Config
	srvAddr string

	// Protects everything below.
	mutex           sync.Mutex
	transport       rpc.Transporter
	stagedTransport rpc.Transporter
	conn            net.Conn
}

// Test that ConnectionTransportTLS fully implements the ConnectionTransport interface.
var _ ConnectionTransport = (*ConnectionTransportTLS)(nil)

// Dial is an implementation of the ConnectionTransport interface.
func (ct *ConnectionTransportTLS) Dial(ctx context.Context) (
	rpc.Transporter, error) {
	var conn net.Conn
	err := runUnlessCanceled(ctx, func() error {
		// load CA certificate
		certs := x509.NewCertPool()
		if !certs.AppendCertsFromPEM(ct.config.RootCerts()) {
			return errors.New("Unable to load root certificates")
		}
		// connect
		config := tls.Config{RootCAs: certs}
		var err error
		conn, err = tls.Dial("tcp", ct.srvAddr, &config)
		return err
	})
	if err != nil {
		return nil, err
	}

	transport := rpc.NewTransport(conn, libkb.NewRPCLogFactory(), libkb.WrapError)
	ct.mutex.Lock()
	defer ct.mutex.Unlock()
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

// SharedKeybaseTransport is a ConnectionTransport implementation that
// uses a shared local socket to a keybase daemon.
type SharedKeybaseTransport struct {
	kbCtx *libkb.GlobalContext

	// Protects everything below.
	mutex           sync.Mutex
	transport       rpc.Transporter
	stagedTransport rpc.Transporter
}

// Test that SharedKeybaseTransport fully implements the
// ConnectionTransport interface.
var _ ConnectionTransport = (*SharedKeybaseTransport)(nil)

// Dial is an implementation of the ConnectionTransport interface.
func (kt *SharedKeybaseTransport) Dial(ctx context.Context) (
	rpc.Transporter, error) {
	_, transport, err := kt.kbCtx.GetSocket(true)
	if err != nil {
		return nil, err
	}

	kt.mutex.Lock()
	defer kt.mutex.Unlock()
	kt.stagedTransport = transport
	return transport, nil
}

// IsConnected is an implementation of the ConnectionTransport interface.
func (kt *SharedKeybaseTransport) IsConnected() bool {
	kt.mutex.Lock()
	defer kt.mutex.Unlock()
	return kt.transport != nil && kt.transport.IsConnected()
}

// Finalize is an implementation of the ConnectionTransport interface.
func (kt *SharedKeybaseTransport) Finalize() {
	kt.mutex.Lock()
	defer kt.mutex.Unlock()
	kt.transport = kt.stagedTransport
	kt.stagedTransport = nil
}

// Close is an implementation of the ConnectionTransport interface.
func (kt *SharedKeybaseTransport) Close() {
	// Since this is a shared connection, do nothing.
}

// Connection encapsulates all client connection handling.
type Connection struct {
	config         Config
	srvAddr        string
	handler        ConnectionHandler
	transport      ConnectionTransport
	errorUnwrapper rpc.ErrorUnwrapper

	mutex         sync.Mutex // protects: client, reconnectChan, and cancelFunc
	client        keybase1.GenericClient
	server        *rpc.Server
	reconnectChan chan struct{}
	cancelFunc    context.CancelFunc // used to cancel the reconnect loop
}

// NewTLSConnection returns a connection that tries to connect to the
// given server address with TLS.
func NewTLSConnection(config Config, srvAddr string,
	errorUnwrapper rpc.ErrorUnwrapper, handler ConnectionHandler, connectNow bool) *Connection {
	transport := &ConnectionTransportTLS{config: config, srvAddr: srvAddr}
	return newConnectionWithTransport(config, handler, transport, errorUnwrapper, connectNow)
}

// NewSharedKeybaseConnection returns a connection that tries to
// connect to the local keybase daemon.
func NewSharedKeybaseConnection(kbCtx *libkb.GlobalContext, config Config,
	handler ConnectionHandler) *Connection {
	transport := &SharedKeybaseTransport{kbCtx: kbCtx}
	return newConnectionWithTransport(config, handler, transport, libkb.ErrorUnwrapper{}, true)
}

// Separate from New*Connection functions above to allow for unit
// testing.
func newConnectionWithTransport(config Config,
	handler ConnectionHandler, transport ConnectionTransport,
	errorUnwrapper rpc.ErrorUnwrapper, connectNow bool) *Connection {
	connection := &Connection{
		config:         config,
		handler:        handler,
		transport:      transport,
		errorUnwrapper: errorUnwrapper,
	}
	if connectNow {
		// start connecting now
		connection.getReconnectChan()
	}
	return connection
}

// connect performs the actual connect() and rpc setup.
func (c *Connection) connect(ctx context.Context) error {
	// connect
	transport, err := c.transport.Dial(ctx)
	if err != nil {
		return err
	}

	client := rpc.NewClient(transport, c.errorUnwrapper)
	server := rpc.NewServer(transport, libkb.WrapError)

	// call the connect handler
	err = c.handler.OnConnect(ctx, c, client, server)
	if err != nil {
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

	return nil
}

// DoCommand executes the specific rpc command wrapped in rpcFunc.
func (c *Connection) DoCommand(ctx context.Context, rpcFunc func(keybase1.GenericClient) error) error {
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
			rawClient := func() keybase1.GenericClient {
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
			if c.handler.ShouldThrottle(throttleErr) {
				return throttleErr
			}
			rpcErr = throttleErr
			return nil
		}, backoff.NewExponentialBackOff(), c.handler.OnDoCommandError)

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
	// inform the handler of our disconnected state
	c.handler.OnDisconnected()
	// kick-off a connection and wait for it to complete
	// or for the caller to cancel.
	reconnectChan := c.getReconnectChan()
	select {
	case <-ctx.Done():
		// caller canceled
		return ctx.Err()
	case <-reconnectChan:
		// reconnect complete
		return nil
	}
}

// Returns true if the error indicates we should retry the command.
func (c *Connection) checkForRetry(err error) bool {
	if err == nil {
		return false
	}
	_, disconnected := err.(rpc.DisconnectedError)
	eof := err == io.EOF
	return disconnected || eof
}

// IsConnected returns true if the connection is connected.
func (c *Connection) IsConnected() bool {
	return c.transport.IsConnected()
}

// This will either kick-off a new reconnection attempt or wait for an
// existing attempt. Returns the channel associated with an attempt.
func (c *Connection) getReconnectChan() chan struct{} {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	if c.reconnectChan == nil {
		var ctx context.Context
		// for canceling the reconnect loop via Shutdown()
		ctx, c.cancelFunc = context.WithCancel(context.Background())
		c.reconnectChan = make(chan struct{}, 20)
		go c.doReconnect(ctx, c.reconnectChan)
	}
	return c.reconnectChan
}

// doReconnect attempts a reconnection.
func (c *Connection) doReconnect(ctx context.Context, reconnectChan chan struct{}) {
	// retry w/exponential backoff
	backoff.RetryNotify(func() error {
		// try to connect
		err := c.connect(ctx)
		// context was canceled by Shutdown()
		if ctx.Err() != nil {
			c.handler = nil // drop the circular reference
			// short-circuit Retry
			return nil
		}
		return err
	}, backoff.NewExponentialBackOff(),
		// give the caller a chance to log any other error or adjust state
		c.handler.OnConnectError)

	// close the reconnect channel to signal we're connected.
	c.mutex.Lock()
	defer c.mutex.Unlock()
	close(reconnectChan)
	c.reconnectChan = nil
	c.cancelFunc = nil
}

// GetClient returns an RPC client that uses DoCommand() for RPC
// calls, and thus handles throttling, disconnections, etc.
func (c *Connection) GetClient() keybase1.GenericClient {
	return connectionClient{c}
}

// GetServer is called to retrieve an rpc server suitable for use by the caller.
func (c *Connection) GetServer() *rpc.Server {
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

var _ keybase1.GenericClient = connectionClient{}

func (c connectionClient) Call(ctx context.Context, s string, args interface{}, res interface{}) error {
	return c.conn.DoCommand(ctx, func(rawClient keybase1.GenericClient) error {
		return rawClient.Call(ctx, s, args, res)
	})
}
